"""
Web search tool for the agent, backed by Tavily.

Two layers of quality control, both applied in code — source authority is
a deterministic judgment, not one that needs an LLM call:
  1. Relevance: Tavily's own per-result score, floor-filtered.
  2. Authority: a domain-tier weighting favoring official, government,
     academic, and major-outlet sources over blogs, forums, and social
     video, with a short hard-exclude list for near-zero-signal domains.

Freshness is opt-in per call: the model sets `recency` / `category` only for
time-sensitive questions. A filtered search that comes back thin is widened
automatically, so a recency filter can never starve a run of sources.

Tools return (text_for_model, source_rows) and never raise — a failed search
is reported to the model as unavailable so the rest of the run continues.
"""

import re
from datetime import date
from typing import Literal
from urllib.parse import urlparse

from tavily import TavilyClient

Recency = Literal["day", "week", "month", "year"]
Category = Literal["general", "news", "finance"]
RECENCY_DAYS = {"day": 1, "week": 7, "month": 31, "year": 365}
CATEGORIES = ("general", "news", "finance")

WEB_SEARCH_SCHEMA = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": (
            "Search the open web — news, official announcements, company and government "
            "sites, current events. Results include publish dates when known."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": (
                        "A focused, specific search query — not the whole topic verbatim. "
                        "Do not add a year unless the user named one; use `recency` for freshness."
                    ),
                },
                "recency": {
                    "type": "string",
                    "enum": list(RECENCY_DAYS),
                    "description": (
                        "Only return pages published within this window. Set it ONLY for "
                        "time-sensitive asks (latest, current, recent, this week/month/year). "
                        "Omit for historical, conceptual, or evergreen topics."
                    ),
                },
                "category": {
                    "type": "string",
                    "enum": list(CATEGORIES),
                    "description": (
                        "'news' for current events and announcements, 'finance' for markets, "
                        "earnings, and stocks, otherwise 'general' (default)."
                    ),
                },
            },
            "required": ["query"],
        },
    },
}

MAX_RESULTS = 5
LOG_SNIPPET_LIMIT = 300        # stored with the project / shown in the UI
CONTENT_LIMIT = 1200           # what the model reads per result

# Stands in for a result's citation number while the tool is running. A tool
# can't know its results' final numbers — those depend on what earlier
# searches already found — so Toolset.run() substitutes them afterwards.
REF_PLACEHOLDER = "[[REF]]"
MIN_RESULTS_BEFORE_WIDENING = 2
MIN_RELEVANCE_SCORE = 0.3
SEARCH_TIMEOUT = 20

HARD_EXCLUDE_DOMAINS = ("reddit.com", "pinterest.com", "quora.com", "tiktok.com")
OFFICIAL_SIGNAL_PATTERNS = ("investor", "ir.", "newsroom", "press")
WIRE_SERVICES = ("prnewswire.com", "businesswire.com", "globenewswire.com")
TIER_2_OUTLETS = (
    "reuters.com", "bloomberg.com", "wsj.com", "apnews.com", "ft.com",
    "nytimes.com", "economist.com", "cnbc.com", "bbc.com",
)
DEPRIORITIZE_DOMAINS = ("youtube.com", "medium.com", "facebook.com", "instagram.com", "x.com", "twitter.com")

# Domain labels that mark an official government/academic authority when they
# are the actual TLD, or the second-level label of a ccTLD (gov.uk, edu.au,
# ac.jp, go.jp, gc.ca, gob.mx, gouv.fr, ...). Matched as whole DNS labels only
# — never as a substring — so a spoofing domain like "irs.gov.evil.com" (real
# domain evil.com, "gov" just embedded as a fake subdomain) is not mistaken
# for an actual .gov site.
GOV_EDU_TLD_LABELS = {"gov", "edu", "mil", "ac"}
GOV_EDU_CC_LABELS = {"gov", "edu", "ac", "go", "gc", "gob", "gouv"}

_YEAR = re.compile(r"\b(?:19|20)\d{2}\b")


def drop_stale_years(query: str, topic: str) -> str:
    """
    Strip past years the model wrote into a recency-filtered query.

    Models anchor "latest" to their training cutoff and append e.g. "2025".
    Only applied when a recency filter is set (a past year contradicts it), and
    a year the user wrote in their own topic is always kept.
    """
    this_year = date.today().year
    cleaned = _YEAR.sub(
        lambda m: m.group(0) if int(m.group(0)) >= this_year or m.group(0) in topic else "",
        query,
    )
    return " ".join(cleaned.split()) or query


def domain_of(url: str) -> str:
    """Host of a URL without "www.", or "" when it can't be parsed."""
    try:
        return urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return ""


def _topic_keywords(topic: str) -> set[str]:
    return set(re.findall(r"[a-zA-Z]{4,}", topic.lower()))


def _is_gov_or_edu(domain: str) -> bool:
    labels = domain.split(".")
    if len(labels) < 2:
        return False
    tld = labels[-1]
    if tld in GOV_EDU_TLD_LABELS:
        return True
    return len(tld) == 2 and labels[-2] in GOV_EDU_CC_LABELS


def _authority_weight(url: str, topic_keywords: set[str]) -> float:
    """Higher = more trusted. Applied as a multiplier on Tavily's relevance score."""
    domain = domain_of(url)
    if not domain:
        return 1.0

    if _is_gov_or_edu(domain):
        return 1.6
    if any(kw in domain for kw in topic_keywords):
        # Likely the topic's own entity domain — e.g. topic "Tesla" -> tesla.com
        if any(sig in domain for sig in OFFICIAL_SIGNAL_PATTERNS) or domain.count(".") <= 1:
            return 1.6
    if any(wire in domain for wire in WIRE_SERVICES):
        return 1.4
    if any(outlet in domain for outlet in TIER_2_OUTLETS):
        return 1.2
    if any(low in domain for low in DEPRIORITIZE_DOMAINS):
        return 0.5

    return 1.0


def top_up(results: list[dict], fetch_unfiltered, key: str, limit: int) -> tuple[list[dict], bool]:
    """
    Pads a thin filtered result list with unfiltered results it doesn't already
    hold, so a recency/category filter can never starve a run of sources.
    Returns (results, widened). A failed unfiltered fetch just adds nothing.
    """
    seen = {r.get(key) for r in results}
    try:
        extra = [r for r in fetch_unfiltered() if r.get(key) not in seen]
    except Exception:
        extra = []
    return results + extra[:limit - len(results)], bool(extra)


def make_web_search(tavily_client: TavilyClient, topic: str = ""):
    topic_keywords = _topic_keywords(topic)

    def _ranked(query: str, recency: str | None, category: str) -> list[dict]:
        response = tavily_client.search(
            query=query, max_results=8, search_depth="advanced",
            topic=category, time_range=recency, timeout=SEARCH_TIMEOUT,
        )
        candidates = [
            r for r in response.get("results", [])
            if r.get("score", 0) >= MIN_RELEVANCE_SCORE
            and not any(bad in domain_of(r.get("url", "")) for bad in HARD_EXCLUDE_DOMAINS)
        ]
        return sorted(
            candidates,
            key=lambda r: r.get("score", 0) * _authority_weight(r.get("url", ""), topic_keywords),
            reverse=True,
        )[:MAX_RESULTS]

    def web_search(
        query: str, recency: Recency | None = None, category: Category = "general",
    ) -> tuple[str, list[dict]]:
        # Models occasionally send values outside the enum — degrade, don't fail.
        recency = recency if recency in RECENCY_DAYS else None
        category = category if category in CATEGORIES else "general"
        if recency:
            query = drop_stale_years(query, topic)

        try:
            ranked = _ranked(query, recency, category)
        except Exception as e:
            return f"Web search unavailable for this query ({e}).", []

        widened = False
        if (recency or category != "general") and len(ranked) < MIN_RESULTS_BEFORE_WIDENING:
            ranked, widened = top_up(ranked, lambda: _ranked(query, None, "general"), "url", MAX_RESULTS)

        if not ranked:
            return "No relevant results found for this query.", []

        rows = [
            {
                "query": query,
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "snippet": (r.get("content") or "")[:LOG_SNIPPET_LIMIT],
                # Reference metadata for the document writers. A web page has
                # no byline to speak of, so the publishing domain stands in as
                # the venue — enough for a usable IEEE entry.
                "venue": domain_of(r.get("url", "")),
                "published": r.get("published_date") or "",
                "kind": "web",
            }
            for r in ranked
        ]
        blocks = []
        for r in ranked:
            published = f"\nPublished: {r['published_date']}" if r.get("published_date") else ""
            blocks.append(
                f"Source {REF_PLACEHOLDER}\n"
                f"Title: {r.get('title')}\nURL: {r.get('url')}{published}\n"
                f"Content: {(r.get('content') or '')[:CONTENT_LIMIT]}"
            )
        note = (
            "Note: few results matched the requested time window/category, so unfiltered "
            "results were added — check their dates before treating them as current.\n\n"
            if widened else ""
        )
        return note + "\n\n".join(blocks), rows

    return web_search
