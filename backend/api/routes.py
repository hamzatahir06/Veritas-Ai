# uvicorn main:app --reload --port 8000
import io
import json
import tempfile
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse, RedirectResponse
from pydantic import BaseModel, EmailStr, Field

from core.auth import get_current_user, get_optional_user, get_supabase
from agent.core import run_research, ResearchResult

# Consolidated and updated imports
from services.storage import (
    save_project, list_projects, get_project, delete_project,
    add_to_waitlist, list_sources,
    upload_document, get_document_url, save_document_paths
)
from services.docx_writer import build_docx, save_research_as_docx
from services.pdf_writer import build_pdf, save_research_as_pdf
from services.brief_review import review as review_brief
from services.document_common import parse_markdown, document_filename

router = APIRouter()


class ResearchRequest(BaseModel):
    topic: str


class DocumentRequest(BaseModel):
    # Bounded so a public render endpoint can't be handed an arbitrarily large job.
    topic: str = Field(max_length=500)
    markdown: str = Field(min_length=1, max_length=60_000)
    sources: list[dict] = Field(default_factory=list, max_length=60)
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
                findings = review_brief(
                    result.markdown, parse_markdown(result.markdown), result.sources
                ).as_dicts()
                if findings:
                    print(f"[review] {len(findings)} finding(s) for {result.topic!r}: "
                          + "; ".join(f["code"] for f in findings))

                project_id = None
                if user:
                    try:
                        project_id = save_project(supabase, user.id, result)
                        
                        # Generate & Upload Documents Automatically
                        with tempfile.TemporaryDirectory() as tmp:
                            docx_local = save_research_as_docx(result, output_dir=tmp)
                            pdf_local = save_research_as_pdf(result, output_dir=tmp)
                            
                            docx_path = upload_document(supabase, user.id, project_id, docx_local)
                            pdf_path = upload_document(supabase, user.id, project_id, pdf_local)
                            
                            save_document_paths(supabase, project_id, docx_path, pdf_path)
                            
                    except Exception as e:
                        # Non-fatal: the brief still streams to the client below.
                        # Distinct from "error" (a fatal run failure) so the UI
                        # can keep the result and just flag the missed save.
                        yield _sse_event({"type": "save_failed", "error": f"Save/Upload failed: {str(e)}"})

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

    # On-Demand Generation for legacy projects (Option A)
    if not path:
        result = ResearchResult(
            topic=project["topic"],
            markdown=project["markdown"],
            sources=project.get("sources", []),
            provider="Retrieved from Archives"
        )
        
        with tempfile.TemporaryDirectory() as tmp:
            docx_local = save_research_as_docx(result, output_dir=tmp)
            pdf_local = save_research_as_pdf(result, output_dir=tmp)
            
            docx_path = upload_document(supabase, user.id, project_id, docx_local)
            pdf_path = upload_document(supabase, user.id, project_id, pdf_local)
            
            save_document_paths(supabase, project_id, docx_path, pdf_path)
            
            path = docx_path if format == "docx" else pdf_path

    # Storage keys are UUIDs, so serve the document under its real name. The
    # date comes from when the brief was created, not when it was downloaded.
    try:
        created = datetime.fromisoformat(str(project.get("created_at")).replace("Z", "+00:00")).date()
    except (TypeError, ValueError):
        created = None
    filename = document_filename(project["topic"], format, today=created)

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

    result = ResearchResult(payload.topic, payload.markdown, payload.sources, payload.provider)
    if format == "pdf":
        content = bytes(build_pdf(result).output())
    else:
        buffer = io.BytesIO()
        build_docx(result).save(buffer)
        content = buffer.getvalue()

    filename = document_filename(payload.topic, format)
    return Response(
        content,
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
