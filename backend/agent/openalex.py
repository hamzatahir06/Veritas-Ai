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

import math
import re
from collections.abc import Container
from datetime import date, timedelta

import requests

from core.config import get_settings
from agent.tools import (
    RECENCY_DAYS, Recency, LOG_SNIPPET_LIMIT, CONTENT_LIMIT, MIN_RESULTS_BEFORE_WIDENING,
    REF_PLACEHOLDER, drop_stale_years, pick, top_up,
)

OPENALEX_URL = "https://api.openalex.org/works"
MAX_RESULTS = 5
# OpenAlex's own top 5 drifts fast: past the first few hits it matches single
# words ("broker" -> real-estate and arms brokering). A wider pool, filtered
# and re-ranked here, is one request either way.
CANDIDATE_POOL = 25
REQUEST_TIMEOUT = 20
# Research output only: drops podcast episodes, datasets, dissertations,
# editorials and the like, which the index also holds.
PAPER_TYPES = "article|review|preprint|conference-paper|book-chapter|report"
# Share of the query's terms a work's title + abstract must contain.
MIN_TERM_COVERAGE = 0.6
# How much citations per year lift a work over its raw relevance. Kept small:
# relevance decides, citations break near-ties toward work the field relies on.
CITATION_WEIGHT = 0.2

# Whole objects (not dotted paths) — keeps the payload small but robust.
_SELECT_FIELDS = ",".join((
    "id", "doi", "title", "publication_year", "publication_date", "cited_by_count",
    "authorships", "primary_location", "open_access", "abstract_inverted_index",
    "relevance_score",
))
_TERM = re.compile(r"[a-z]{4,}")

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
    """Up to three author names, "et al." beyond that; "" when none are listed."""
    names = [a.get("author", {}).get("display_name", "") for a in work.get("authorships", [])]
    names = [n for n in names if n]
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
    # A work without an abstract gives the model a title and nothing to cite;
    # a retracted one is not evidence.
    filters = ["has_abstract:true", "is_retracted:false", f"type:{PAPER_TYPES}"]
    if recency:
        since = date.today() - timedelta(days=RECENCY_DAYS[recency])
        filters.append(f"from_publication_date:{since.isoformat()}")
    params = {"search": query, "per_page": CANDIDATE_POOL, "select": _SELECT_FIELDS, "filter": ",".join(filters)}
    if api_key := get_settings().openalex_api_key:
        params["api_key"] = api_key
    resp = requests.get(OPENALEX_URL, params=params, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.json().get("results", [])


def _covers(work: dict, terms: set[str]) -> bool:
    """
    The work's title + abstract contain most of the query's terms.

    Matched on a term's first five letters, a cheap stem: "brokers" matches
    "broker" and "brokerage", "tracking" matches "tracked".
    """
    if not terms:
        return True
    text = f"{work.get('title') or ''} {_abstract_from_inverted_index(work.get('abstract_inverted_index'))}".lower()
    hits = sum(term[:5] in text for term in terms)
    return hits >= MIN_TERM_COVERAGE * len(terms)


def _score(work: dict) -> float:
    """OpenAlex relevance, nudged up by citations per year since publication, so
    a new paper isn't buried under old ones just for having had less time."""
    age = max(date.today().year - (work.get("publication_year") or date.today().year), 0) + 1
    per_year = (work.get("cited_by_count") or 0) / age
    return (work.get("relevance_score") or 0) * (1 + CITATION_WEIGHT * math.log1p(per_year))


def _best(query: str, recency: str | None) -> list[dict]:
    """The pool for a query, on-topic works only, best first, one per title
    (a preprint and its published version are the same evidence)."""
    terms = set(_TERM.findall(query.lower()))
    works = sorted((w for w in _fetch(query, recency) if _covers(w, terms)), key=_score, reverse=True)
    unique: dict[str, dict] = {}
    for w in works:
        unique.setdefault((w.get("title") or "").strip().lower() or w.get("id"), w)
    return list(unique.values())


def make_scholarly_search(topic: str, seen: Container[str] = ()):
    """`seen` holds the URLs the run has already found (see tools.pick())."""
    def scholarly_search(query: str, recency: Recency | None = None) -> tuple[str, list[dict]]:
        recency = recency if recency in RECENCY_DAYS else None
        if recency:
            query = drop_stale_years(query, topic)

        try:
            works = _best(query, recency)
        except Exception as e:
            # Supplementary source — never break the run over it.
            return f"Scholarly search unavailable for this query ({e}).", []

        widened = False
        if recency and len(works) < MIN_RESULTS_BEFORE_WIDENING:
            works, widened = top_up(works, lambda: _best(query, None), "id", CANDIDATE_POOL)
        works = pick(works, _best_url, seen, MAX_RESULTS)

        if not works:
            return "No peer-reviewed results found for this query.", []

        rows, blocks = [], []
        for w in works:
            title = (w.get("title") or "Untitled").strip()
            published = w.get("publication_date") or w.get("publication_year") or "n.d."
            url = _best_url(w)
            abstract = _abstract_from_inverted_index(w.get("abstract_inverted_index"))
            authors, venue = _authors(w), _venue(w)

            rows.append({
                "query": query,
                "title": title,
                "url": url,
                "snippet": (abstract or f"{venue} ({published}).")[:LOG_SNIPPET_LIMIT],
                # Reference metadata the document writers turn into IEEE entries.
                "authors": authors,
                "venue": venue,
                "published": str(published),
                "kind": "scholarly",
            })
            blocks.append(
                f"Source {REF_PLACEHOLDER}\n"
                f"Title: {title}\n"
                f"Authors: {authors or 'Unknown authors'}\n"
                f"Source: {venue}, published {published} · {w.get('cited_by_count', 0)} citations\n"
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
