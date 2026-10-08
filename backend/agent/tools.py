"""
Web search tool for the agent, backed by Tavily.

Reliability comes first, in three layers, all deterministic and in code:
  1. Reach: the model can aim a search at an organisation's own site (the
     `domains` argument): who.int for WHO guidance, nasa.gov for NASA
     missions, a company's site for its leadership. A thin targeted search
     widens to the open web automatically, so it can never starve a run.
  2. Relevance: Tavily's own per-result score, floor-filtered, over a pool
     wide enough that official pages are in it to be promoted.
  3. Authority: an exact-domain tier. Official government, intergovernmental,
     academic and the topic's own organisation come first; peer-reviewed
     publishers, wire services and major outlets next; SEO market-report farms
     and social media last; a few near-zero-signal domains are excluded. Each
     result tells the model its tier, so it knows what it is citing.
  4. Breadth (pick()): at most two results per site in an open search, and
     pages the run already found give their slots to new ones.

Freshness is opt-in per call: the model sets `recency` / `category` only for
time-sensitive questions, with the same automatic widening.

Tools return (text_for_model, source_rows) and never raise: a failed search
is reported to the model as unavailable so the rest of the run continues.
"""

import re
from datetime import date
from typing import Container, Literal
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
                "domains": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Official sites to search within, e.g. [\"who.int\"], [\"nasa.gov\"], "
                        "[\"nvidia.com\"]. Use it when the question concerns a specific "
                        "organisation, agency, or company: its leadership, statements, policies, "
                        "data, or products. Bare domains only, at most 5. Omit for broad questions."
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
# Tavily bills per search, not per result: a wider pool costs nothing and gives
# the authority ranking official pages to promote.
CANDIDATE_POOL = 15
MAX_DOMAINS = 5
PER_SITE_LIMIT = 2             # results from one site in an open search
LOG_SNIPPET_LIMIT = 300        # stored with the project / shown in the UI
# What the model reads per result. Advanced-depth Tavily content is already the
# page's most relevant chunks (~1-2.5K chars), and an abstract's conclusion sits
# at its end, so this is a runaway guard, not a trim.
CONTENT_LIMIT = 3000

# Stands in for a result's citation number while the tool is running. A tool
# can't know its results' final numbers — those depend on what earlier
# searches already found — so Toolset.run() substitutes them afterwards.
REF_PLACEHOLDER = "[[REF]]"
MIN_RESULTS_BEFORE_WIDENING = 2
MIN_RELEVANCE_SCORE = 0.3
SEARCH_TIMEOUT = 20

HARD_EXCLUDE_DOMAINS = ("reddit.com", "pinterest.com", "quora.com", "tiktok.com")

# Treaty-based and intergovernmental bodies outside the .int TLD.
INTERGOVERNMENTAL = (
    "un.org", "worldbank.org", "imf.org", "oecd.org", "wto.org", "unesco.org", "unicef.org",
    "unep.org", "undp.org", "iaea.org", "ipcc.ch", "europa.eu", "bis.org", "iea.org",
)
PEER_REVIEWED = (
    "nature.com", "science.org", "cell.com", "thelancet.com", "nejm.org", "bmj.com",
    "jamanetwork.com", "pnas.org", "sciencedirect.com", "springer.com", "wiley.com",
    "plos.org", "ieee.org", "acm.org",
)
WIRE_SERVICES = ("prnewswire.com", "businesswire.com", "globenewswire.com")
MAJOR_OUTLETS = (
    "reuters.com", "bloomberg.com", "wsj.com", "apnews.com", "ft.com",
    "nytimes.com", "economist.com", "cnbc.com", "bbc.com", "bbc.co.uk",
)
# Social media, and SEO market-report farms that publish a paywalled "market
# size" page for every keyword and outrank real sources on search engines.
LOW_AUTHORITY = (
    "youtube.com", "medium.com", "facebook.com", "instagram.com", "x.com", "twitter.com",
    "linkedin.com", "gminsights.com", "dataintelo.com", "marketsandmarkets.com",
    "researchandmarkets.com", "grandviewresearch.com", "precedenceresearch.com",
    "fortunebusinessinsights.com", "alliedmarketresearch.com", "mordorintelligence.com",
    "globalmarketinsights.com", "marketresearchfuture.com", "verifiedmarketresearch.com",
    "expertmarketresearch.com", "imarcgroup.com", "custommarketinsights.com",
)
# New report farms appear faster than any list grows, but they share a URL
# shape: a report path for a "<keyword>-market" page, e.g.
# /research-report/solid-state-battery-market, /reports/ev-charger-market-1234.
_MARKET_REPORT_PATH = re.compile(r"/[a-z-]*reports?/.*-market(?:-\d+)?(?:[/.]|$)")

# Domain labels that mark an official government/academic authority when they
# are the actual TLD, or the second-level label of a ccTLD (gov.uk, edu.au,
# ac.jp, go.jp, gc.ca, gob.mx, gouv.fr, ...). Matched as whole DNS labels only
# — never as a substring — so a spoofing domain like "irs.gov.evil.com" (real
# domain evil.com, "gov" just embedded as a fake subdomain) is not mistaken
# for an actual .gov site. `.int` is reserved for treaty bodies (WHO, ESA).
GOV_EDU_TLD_LABELS = {"gov", "edu", "mil", "ac", "int"}
GOV_EDU_CC_LABELS = {"gov", "edu", "ac", "go", "gc", "gob", "gouv"}
# Second-level labels a ccTLD sells names under: bbc.co.uk's name is "bbc".
_CC_SECOND_LEVEL = {"co", "com", "org", "net", "ne", "or"} | GOV_EDU_CC_LABELS

# (weight, label). The weight multiplies Tavily's relevance score; the label
# is shown to the model with the result.
OFFICIAL = (1.6, "official source (government, intergovernmental or academic)")
OWN_SITE = (1.6, "official source (the organisation's own site)")
PEER_REVIEWED_TIER = (1.5, "peer-reviewed publisher")
WIRE_TIER = (1.4, "press release via wire service (self-reported)")
MAJOR_OUTLET_TIER = (1.2, "major news outlet")
UNRATED = (1.0, "")
LOW_TIER = (0.4, "low authority (social media or SEO market-report site)")

_YEAR = re.compile(r"\b(?:19|20)\d{2}\b")
_SITE_OPERATOR = re.compile(r"\bsite:(\S+)", re.IGNORECASE)


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


def _is_under(domain: str, sites) -> bool:
    """`domain` is one of `sites` or a subdomain of one. Whole labels only, so
    microsoft.com is not under ft.com and spacex.com is not under x.com."""
    return any(domain == site or domain.endswith("." + site) for site in sites)


def _site_label(domain: str) -> str:
    """The name a domain is registered under: "tesla" for ir.tesla.com, "bbc" for bbc.co.uk."""
    labels = domain.split(".")
    if len(labels) >= 3 and len(labels[-1]) == 2 and labels[-2] in _CC_SECOND_LEVEL:
        return labels[-3]
    return labels[-2] if len(labels) >= 2 else domain


def clean_domains(domains) -> tuple[str, ...]:
    """The model's `domains` as bare hosts ("https://www.WHO.int/x" -> "who.int"); junk dropped."""
    if not isinstance(domains, list):
        return ()
    hosts: list[str] = []
    for d in domains:
        d = str(d).strip()
        host = domain_of(d if "//" in d else f"//{d}")
        if "." in host and host not in hosts:
            hosts.append(host)
    return tuple(hosts[:MAX_DOMAINS])


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


def authority(url: str, topic_keywords: set[str], own_sites: tuple[str, ...] = ()) -> tuple[float, str]:
    """(weight, label) for a result's source; the tiers are defined above."""
    domain = domain_of(url)
    if not domain:
        return UNRATED
    if _is_gov_or_edu(domain) or _is_under(domain, INTERGOVERNMENTAL):
        return OFFICIAL
    # The organisation's own site: one the model aimed the search at, or one
    # registered under a word of the topic ("tesla" -> ir.tesla.com, but not
    # teslarati.com).
    if _is_under(domain, own_sites) or _site_label(domain) in topic_keywords:
        return OWN_SITE
    if _is_under(domain, PEER_REVIEWED):
        return PEER_REVIEWED_TIER
    if _is_under(domain, WIRE_SERVICES):
        return WIRE_TIER
    if _is_under(domain, MAJOR_OUTLETS):
        return MAJOR_OUTLET_TIER
    if _is_under(domain, LOW_AUTHORITY) or _MARKET_REPORT_PATH.search(urlparse(url).path.lower()):
        return LOW_TIER
    return UNRATED


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


def pick(candidates: list[dict], url_of, seen: Container[str], limit: int, per_site: int | None = None) -> list[dict]:
    """
    The `limit` results to show, from candidates already ranked best first.

    A page an earlier search in the run already found adds nothing the model
    hasn't read, so new pages fill the slots first. With `per_site`, no site
    takes more than that many of them, so one site can't make up the whole
    answer. Pages held back by either rule only fill slots nothing else can,
    and the site cap gives way first: a further page from the same site is
    still new evidence, a repeat is not.
    """
    counts: dict[str, int] = {}
    first, overflow, repeats = [], [], []
    for c in candidates:
        url = url_of(c)
        if url in seen:
            repeats.append(c)
            continue
        site = domain_of(url)
        counts[site] = counts.get(site, 0) + 1
        (first if not per_site or counts[site] <= per_site else overflow).append(c)
    return (first + overflow + repeats)[:limit]


def make_web_search(tavily_client: TavilyClient, topic: str, seen: Container[str] = ()):
    """`seen` holds the URLs the run has already found (see pick())."""
    topic_keywords = _topic_keywords(topic)

    def _ranked(
        query: str, recency: str | None, category: str, domains: tuple[str, ...], own_sites: tuple[str, ...],
    ) -> list[dict]:
        """Top results, best first, each carrying its `authority` label.
        `domains` restricts the search; `own_sites` only feeds the ranking, so
        a widened search still ranks the organisation's own pages first."""
        response = tavily_client.search(
            query=query, max_results=CANDIDATE_POOL, search_depth="advanced",
            topic=category, time_range=recency, timeout=SEARCH_TIMEOUT,
            include_domains=list(domains),
            # Excluded at the source so they don't take result slots; the
            # filter below still catches any subdomain that slips through.
            exclude_domains=list(HARD_EXCLUDE_DOMAINS),
        )
        scored = []
        for r in response.get("results", []):
            if r.get("score", 0) < MIN_RELEVANCE_SCORE or _is_under(domain_of(r.get("url", "")), HARD_EXCLUDE_DOMAINS):
                continue
            weight, r["authority"] = authority(r.get("url", ""), topic_keywords, own_sites)
            scored.append((r.get("score", 0) * weight, r))
        ranked = [r for _, r in sorted(scored, key=lambda pair: pair[0], reverse=True)]
        # One page per title: an article and its /amp or syndicated copy would
        # otherwise fill two of the five slots with the same evidence.
        unique = {}
        for r in ranked:
            unique.setdefault((r.get("title") or "").strip().lower() or r.get("url"), r)
        # No site cap when the search was aimed at sites: those are the point.
        return pick(
            list(unique.values()), lambda r: r.get("url", ""), seen, MAX_RESULTS,
            per_site=None if domains else PER_SITE_LIMIT,
        )

    def web_search(
        query: str, recency: Recency | None = None, category: Category = "general",
        domains: list[str] | None = None,
    ) -> tuple[str, list[dict]]:
        # Models occasionally send values outside the enum — degrade, don't fail.
        recency = recency if recency in RECENCY_DAYS else None
        category = category if category in CATEGORIES else "general"
        # Models used to Google write "site:who.int" into the query; Tavily would
        # read it as words, so it becomes a domain restriction instead.
        sites = _SITE_OPERATOR.findall(query)
        if sites:
            query = " ".join(_SITE_OPERATOR.sub(" ", query).split()) or query
            domains = [*(domains if isinstance(domains, list) else []), *sites]
        domains = clean_domains(domains)
        if recency:
            query = drop_stale_years(query, topic)

        try:
            ranked = _ranked(query, recency, category, domains, domains)
        except Exception as e:
            return f"Web search unavailable for this query ({e}).", []

        widened = False
        if (recency or category != "general" or domains) and len(ranked) < MIN_RESULTS_BEFORE_WIDENING:
            ranked, widened = top_up(
                ranked, lambda: _ranked(query, None, "general", (), domains), "url", MAX_RESULTS,
            )

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
            rated = f"\nAuthority: {r['authority']}" if r["authority"] else ""
            blocks.append(
                f"Source {REF_PLACEHOLDER}\n"
                f"Title: {r.get('title')}\nURL: {r.get('url')}{published}{rated}\n"
                f"Content: {(r.get('content') or '')[:CONTENT_LIMIT]}"
            )
        note = (
            "Note: few results matched the requested time window, category or sites, so "
            "unfiltered results were added — check their dates and authority before relying "
            "on them.\n\n"
            if widened else ""
        )
        return note + "\n\n".join(blocks), rows

    return web_search
