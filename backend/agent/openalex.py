"""
Scholarly search tool for the agent, backed by OpenAlex (https://openalex.org).

OpenAlex is a free, open index of ~250M scholarly works — journal articles,
conference papers, preprints, datasets — with no API key required. It gives
the agent a path to peer-reviewed primary literature that a general web search
(agent/tools.py) rarely surfaces, because much of that literature sits on
publisher domains that either rank poorly or are paywalled.

Same contract as make_web_search: a factory returning a callable that yields
(text_for_model, source_rows). Failures degrade to a plain-text "unavailable"
result rather than raising — this is a supplementary source and must not take
down an otherwise-fine run.
"""

from datetime import date, timedelta

import requests

from agent.tools import (
    RECENCY_DAYS, Recency, LOG_SNIPPET_LIMIT, CONTENT_LIMIT, MIN_RESULTS_BEFORE_WIDENING,
    REF_PLACEHOLDER, drop_stale_years,
)

OPENALEX_URL = "https://api.openalex.org/works"
MAX_RESULTS = 5
REQUEST_TIMEOUT = 20

# Whole objects (not dotted paths) — keeps the payload small but robust.
_SELECT_FIELDS = ",".join((
    "id", "doi", "title", "publication_year", "publication_date", "cited_by_count",
    "authorships", "primary_location", "open_access", "abstract_inverted_index",
))

SCHOLARLY_SEARCH_SCHEMA = {
    "type": "function",
    "function": {
        "name": "scholarly_search",
        "description": (
            "Search peer-reviewed academic literature — journal articles, conference "
            "papers, and preprints — via an open scholarly index. Use this instead of "
            "web_search for scientific, medical, engineering, economic, or other "
            "research questions where the answer should rest on primary studies rather "
            "than news or blogs. Returns title, authors, venue, date, citation count, "
            "and abstract."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Key concepts and terms to search for — not a full sentence, no year.",
                },
                "recency": {
                    "type": "string",
                    "enum": list(RECENCY_DAYS),
                    "description": (
                        "Only return works published within this window. Use 'year' for "
                        "latest/recent research (indexing lags, so shorter windows are "
                        "usually empty). Omit for established or foundational topics."
                    ),
                },
            },
            "required": ["query"],
        },
    },
}


def _abstract_from_inverted_index(inv: dict | None) -> str:
    """OpenAlex ships abstracts as {word: [positions]}; rebuild the plain text."""
    if not inv:
        return ""
    ordered = sorted((pos, word) for word, positions in inv.items() for pos in positions)
    return " ".join(word for _, word in ordered)


def _authors(work: dict) -> str:
    names = [a.get("author", {}).get("display_name", "") for a in work.get("authorships", [])]
    names = [n for n in names if n]
    if not names:
        return "Unknown authors"
    if len(names) <= 3:
        return ", ".join(names)
    return f"{', '.join(names[:3])} et al."


def _venue(work: dict) -> str:
    source = (work.get("primary_location") or {}).get("source") or {}
    return source.get("display_name") or "Preprint / unpublished"


def _best_url(work: dict) -> str:
    oa_url = (work.get("open_access") or {}).get("oa_url")
    if oa_url:
        return oa_url
    if work.get("doi"):
        return work["doi"]  # OpenAlex returns a full https://doi.org/... URL
    loc = work.get("primary_location") or {}
    return loc.get("landing_page_url") or work.get("id") or ""


def _fetch(query: str, recency: str | None) -> list[dict]:
    params = {"search": query, "per_page": MAX_RESULTS, "select": _SELECT_FIELDS}
    if recency:
        since = date.today() - timedelta(days=RECENCY_DAYS[recency])
        params["filter"] = f"from_publication_date:{since.isoformat()}"
    resp = requests.get(OPENALEX_URL, params=params, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.json().get("results", [])


def make_scholarly_search(topic: str = ""):
    def scholarly_search(query: str, recency: Recency | None = None) -> tuple[str, list[dict]]:
        recency = recency if recency in RECENCY_DAYS else None
        if recency:
            query = drop_stale_years(query, topic)

        try:
            works = _fetch(query, recency)
        except Exception as e:
            # Supplementary source — never break the run over it.
            return f"Scholarly search unavailable for this query ({e}).", []

        widened = False
        if recency and len(works) < MIN_RESULTS_BEFORE_WIDENING:
            seen = {w.get("id") for w in works}
            try:
                extra = [w for w in _fetch(query, None) if w.get("id") not in seen]
            except Exception:
                extra = []
            works += extra[:MAX_RESULTS - len(works)]
            widened = bool(extra)

        if not works:
            return "No peer-reviewed results found for this query.", []

        rows, blocks = [], []
        for w in works:
            title = (w.get("title") or "Untitled").strip()
            published = w.get("publication_date") or w.get("publication_year") or "n.d."
            url = _best_url(w)
            abstract = _abstract_from_inverted_index(w.get("abstract_inverted_index"))

            authors = _authors(w)
            rows.append({
                "query": query,
                "title": title,
                "url": url,
                "snippet": (abstract or f"{_venue(w)} ({published}).")[:LOG_SNIPPET_LIMIT],
                # Reference metadata the document writers turn into IEEE
                # entries. The model-facing text keeps "Unknown authors" as a
                # readable placeholder; a reference list must not print it.
                "authors": "" if authors == "Unknown authors" else authors,
                "venue": _venue(w),
                "published": str(published),
                "kind": "scholarly",
            })
            blocks.append(
                f"Source {REF_PLACEHOLDER}\n"
                f"Title: {title}\n"
                f"Authors: {_authors(w)}\n"
                f"Source: {_venue(w)}, published {published} · {w.get('cited_by_count', 0)} citations\n"
                f"URL: {url}\n"
                f"Abstract: {abstract[:CONTENT_LIMIT]}"
            )

        note = (
            "Note: few works matched the requested time window, so older works were added — "
            "check their dates before treating them as recent.\n\n"
            if widened else ""
        )
        return note + "\n\n".join(blocks), rows

    return scholarly_search
