import io
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse, Response, StreamingResponse
from pydantic import BaseModel, EmailStr, Field

from agent.core import ResearchResult, run_research
from core.auth import get_current_user, get_optional_user, get_supabase
from services.brief_review import review as review_brief
from services.document_common import document_filename, parse_markdown
from services.docx_writer import build_docx
from services.pdf_writer import build_pdf
from services.storage import (
    add_to_waitlist, delete_project, get_document_url, get_project, list_projects,
    list_sources, save_document_paths, save_project, upload_document,
)

router = APIRouter()


# Public endpoints take bounded input, so one request can't hand the agent or a
# renderer an arbitrarily large job.
MAX_TOPIC = 2_000


class ResearchRequest(BaseModel):
    topic: str = Field(max_length=MAX_TOPIC)


class DocumentSource(BaseModel):
    # Exactly the fields build_references() reads; anything else is ignored.
    url: str = Field(default="", max_length=2_000)
    title: str = Field(default="", max_length=1_000)
    authors: str = Field(default="", max_length=1_000)
    venue: str = Field(default="", max_length=500)
    published: str = Field(default="", max_length=100)


class DocumentRequest(BaseModel):
    topic: str = Field(max_length=MAX_TOPIC)
    markdown: str = Field(min_length=1, max_length=60_000)
    sources: list[DocumentSource] = Field(default_factory=list, max_length=60)
    provider: str = Field(default="", max_length=100)


DOCUMENT_MIME = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


class WaitlistRequest(BaseModel):
    # Optional: signed-in users are identified by their token, not a posted email.
    email: EmailStr | None = None


@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.get("/sources")
def get_sources(user=Depends(get_current_user), supabase=Depends(get_supabase)):
    return list_sources(supabase, user.id)


@router.get("/me")
def read_current_user(user=Depends(get_current_user)):
    return {"id": user.id, "email": user.email}


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _render(result: ResearchResult, fmt: str) -> bytes:
    """One brief as .pdf / .docx bytes, rendered in memory."""
    if fmt == "pdf":
        return bytes(build_pdf(result).output())
    buffer = io.BytesIO()
    build_docx(result).save(buffer)
    return buffer.getvalue()


def _store_documents(supabase, user_id: str, project_id: str, result: ResearchResult) -> dict[str, str]:
    """Renders both formats, uploads them, and records their paths. Returns {fmt: storage path}."""
    paths = {
        fmt: upload_document(supabase, user_id, project_id, _render(result, fmt), fmt, mime)
        for fmt, mime in DOCUMENT_MIME.items()
    }
    save_document_paths(supabase, project_id, paths["docx"], paths["pdf"])
    return paths


@router.post("/waitlist")
def join_waitlist(
    payload: WaitlistRequest,
    user=Depends(get_optional_user),
    supabase=Depends(get_supabase),
):
    """Public endpoint. Signed-in users join with their account email + user_id
    (any posted email is ignored); signed-out visitors must supply an email."""
    if user is not None:
        email, user_id = user.email, user.id
    else:
        if not payload.email:
            raise HTTPException(status_code=422, detail="Email is required")
        email, user_id = payload.email, None

    added = add_to_waitlist(supabase, email.strip().lower(), user_id=user_id)
    return {"added": added}


@router.post("/research")
def research(payload: ResearchRequest, user=Depends(get_optional_user), supabase=Depends(get_supabase)):
    """
    Streams agent progress live, then a final event with the result.
    Signed-in users get the run saved as a Project, and documents are generated.
    """
    topic = payload.topic

    def event_stream():
        try:
            for event in run_research(topic):
                if event["type"] != "done":
                    yield _sse_event(event)
                    continue

                result = event["result"]

                # Deterministic quality gate: report-only by design, so a
                # failing check never blocks the brief or the save. Runs here
                # rather than in agent/core.py to keep the agent package free
                # of the services layer.
                findings = review_brief(result.markdown, parse_markdown(result.markdown), result.sources)
                if findings:
                    print(f"[review] {len(findings)} finding(s) for {result.topic!r}: "
                          + "; ".join(f["code"] for f in findings))

                project_id = None
                if user:
                    try:
                        project_id = save_project(supabase, user.id, result)
                    except Exception as e:
                        # Non-fatal: the brief still streams to the client below.
                        # Distinct from "error" (a fatal run failure) so the UI
                        # can keep the result and just flag the missed save.
                        yield _sse_event({"type": "save_failed", "error": f"Save failed: {e}"})
                if project_id:
                    try:
                        _store_documents(supabase, user.id, project_id, result)
                    except Exception as e:
                        # The project IS saved; download_document() renders any
                        # missing file on first download, so this isn't a failed save.
                        print(f"[documents] upload failed for project {project_id}: {e}")

                yield _sse_event({
                    "type": "done",
                    "project_id": project_id,
                    "saved": project_id is not None,
                    "topic": result.topic,
                    "markdown": result.markdown,
                    "sources": result.sources,
                    "provider": result.provider,
                    "review": findings,
                })
        except Exception as e:
            yield _sse_event({"type": "error", "message": f"Unexpected server error: {e}"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            # Keep proxies (nginx, most PaaS/CDN layers) from buffering the
            # whole stream and delivering it at once — the live progress feed
            # is the point of this endpoint.
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/projects/{project_id}/download/{format}")
def download_document(
    project_id: str,
    format: str,
    user=Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Returns a short-lived signed URL. Generates legacy documents on-the-fly if missing."""
    if format not in DOCUMENT_MIME:
        raise HTTPException(status_code=400, detail="Format must be 'docx' or 'pdf'")

    project = get_project(supabase, user.id, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    path = project.get(f"{format}_path")
    result = ResearchResult(
        topic=project["topic"],
        markdown=project["markdown"],
        sources=project.get("sources", []),
        provider="Retrieved from Archives",
    )

    # Projects saved before documents were generated get them on first download.
    if not path:
        path = _store_documents(supabase, user.id, project_id, result)[format]

    # Storage keys are UUIDs, so serve the document under its real name. The
    # date comes from when the brief was created, not when it was downloaded.
    try:
        created = datetime.fromisoformat(str(project.get("created_at")).replace("Z", "+00:00")).date()
    except (TypeError, ValueError):
        created = None
    filename = document_filename(result.title, format, today=created)

    signed_url = get_document_url(supabase, path, download_as=filename)
    return RedirectResponse(url=signed_url)


@router.post("/documents/{format}")
def render_document(format: str, payload: DocumentRequest):
    """
    Renders a brief the client already holds into a .pdf / .docx, in memory.

    Public on purpose: it is how guests download their brief, so they get the
    same document as signed-in users. It reads and writes nothing — no DB, no
    Storage — which keeps the "guests get zero writes" rule.
    """
    if format not in DOCUMENT_MIME:
        raise HTTPException(status_code=400, detail="Format must be 'docx' or 'pdf'")

    sources = [s.model_dump() for s in payload.sources]
    result = ResearchResult(payload.topic, payload.markdown, sources, payload.provider)
    filename = document_filename(result.title, format)
    return Response(
        _render(result, format),
        media_type=DOCUMENT_MIME[format],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/projects")
def get_projects(user=Depends(get_current_user), supabase=Depends(get_supabase)):
    return list_projects(supabase, user.id)


@router.get("/projects/{project_id}")
def get_single_project(project_id: str, user=Depends(get_current_user), supabase=Depends(get_supabase)):
    project = get_project(supabase, user.id, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/projects/{project_id}", status_code=204)
def delete_single_project(project_id: str, user=Depends(get_current_user), supabase=Depends(get_supabase)):
    if not delete_project(supabase, user.id, project_id):
        raise HTTPException(status_code=404, detail="Project not found")
