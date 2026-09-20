"""
Supabase persistence for completed research runs.

Kept separate from agent/core.py on purpose — the agent never imports
this, so a CLI run or background job can reuse the exact same core loop
without ever touching a database.
"""

from supabase import Client
from agent.core import ResearchResult
import os
from pathlib import Path


def save_project(supabase: Client, user_id: str, result: ResearchResult) -> str:
    """Writes a completed research run to the DB. Returns the new project id."""
    project = supabase.table("projects").insert({
        "user_id": user_id,
        "topic": result.topic,
        "title": result.topic,
        "status": "completed",
        "markdown": result.markdown,
    }).execute()
    project_id = project.data[0]["id"]

    if result.sources:
        # authors/venue/published/kind are what the document writers rebuild the
        # IEEE reference list from (services/document_common.build_references).
        # Persisting them is what keeps a brief re-downloaded months later
        # identical to the one generated at research time.
        rows = [
            {
                "project_id": project_id,
                "query": s["query"],
                "title": s.get("title", ""),
                "url": s.get("url", ""),
                "snippet": s.get("snippet", ""),
                "authors": s.get("authors", ""),
                "venue": s.get("venue", ""),
                "published": s.get("published", ""),
                "kind": s.get("kind", ""),
            }
            for s in result.sources
        ]
        supabase.table("sources").insert(rows).execute()

    return project_id


def list_projects(supabase: Client, user_id: str) -> list[dict]:
    res = (
        supabase.table("projects")
        .select("id, topic, title, status, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data


def get_project(supabase: Client, user_id: str, project_id: str) -> dict | None:
    project_res = (
        supabase.table("projects")
        .select("*")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not project_res.data:
        return None
    project = project_res.data[0]

    sources_res = (
        supabase.table("sources").select("*").eq("project_id", project_id).execute()
    )
    return {**project, "sources": sources_res.data}


def delete_project(supabase: Client, user_id: str, project_id: str) -> bool:
    """Deletes a research run the user owns — its sources rows, generated
    documents, and the project row. Returns False if no such project belongs
    to this user (so the caller can 404)."""
    owned = (
        supabase.table("projects")
        .select("id, docx_path, pdf_path")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not owned.data:
        return False
    project = owned.data[0]

    # Storage cleanup is best-effort: a missing or unreachable object must
    # not block removal of the DB rows.
    paths = [p for p in (project.get("docx_path"), project.get("pdf_path")) if p]
    if paths:
        try:
            supabase.storage.from_("documents").remove(paths)
        except Exception:
            pass

    supabase.table("sources").delete().eq("project_id", project_id).execute()
    supabase.table("projects").delete().eq("id", project_id).eq("user_id", user_id).execute()
    return True


def add_to_waitlist(supabase: Client, email: str, user_id: str | None = None) -> bool:
    """Adds an email to the waitlist. Returns True if newly added, False if
    it was already on the list (not treated as an error). `user_id` links the
    entry to an auth.users row when the joiner is signed in."""
    row = {"email": email, "source": "pro_waitlist"}
    if user_id:
        row["user_id"] = user_id
    try:
        supabase.table("waitlist").insert(row).execute()
        return True
    except Exception as e:
        if "duplicate key" in str(e).lower() or "unique" in str(e).lower():
            return False
        raise


def list_sources(supabase: Client, user_id: str) -> list[dict]:
    """All sources across every project owned by this user, most recent first."""
    res = (
        supabase.table("sources")
        .select("id, query, title, url, snippet, created_at, project_id, projects!inner(topic, user_id)")
        .eq("projects.user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data


def upload_document(supabase: Client, user_id: str, project_id: str, file_path: str) -> str:
    """Uploads a local file to Supabase Storage and returns the storage path."""
    suffix = Path(file_path).suffix  # .docx or .pdf
    storage_path = f"{user_id}/{project_id}{suffix}"
    
    with open(file_path, "rb") as f:
        supabase.storage.from_("documents").upload(
            path=storage_path,
            file=f.read(),
            file_options={"content-type": "application/octet-stream", "upsert": "true"},
        )
    return storage_path


def get_document_url(
    supabase: Client, storage_path: str, expires_in: int = 300, download_as: str = "",
) -> str:
    """
    Returns a signed URL valid for expires_in seconds (default 5 minutes).

    Objects are keyed `{user_id}/{project_id}.pdf`, so without `download_as`
    the browser saves the brief under a UUID. Passing a filename sets the
    Content-Disposition Supabase serves, which is what the reader actually
    ends up with on disk.
    """
    options = {"download": download_as} if download_as else None
    result = supabase.storage.from_("documents").create_signed_url(
        storage_path, expires_in, options=options
    )
    return result["signedURL"]


def save_document_paths(supabase: Client, project_id: str, docx_path: str, pdf_path: str) -> None:
    """Stores the storage paths on the project row so we can fetch them later."""
    supabase.table("projects").update({
        "docx_path": docx_path,
        "pdf_path": pdf_path,
    }).eq("id", project_id).execute()