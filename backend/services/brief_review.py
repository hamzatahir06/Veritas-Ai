"""
Deterministic quality gate for a draft brief.

Every check here is mechanical — a missing mandatory section, a citation
pointing at a source that doesn't exist, a banned marketing word. None of it
needs a model call, so a run costs nothing extra in latency or tokens.

Policy is report-only by design: review() returns findings, it never rewrites
the draft and never raises. A brief that fails a check still renders; the
caller decides whether to surface, log, or ignore the findings. That keeps a
formatting opinion from ever being able to kill a research run.
"""

import re
from dataclasses import dataclass, field

from services.document_common import Block, citation_numbers, plain_text, strip_citations

# Section 8 of the house spec — the phrasing that gets a brief rejected on
# sight by a senior reader.
BANNED_PHRASES = (
    "revolutionary", "groundbreaking", "game-changing", "game changing",
    "cutting-edge", "cutting edge", "seamless", "delve", "delving",
    "in today's fast-paced world", "in today's rapidly evolving",
    "it is important to note", "it's important to note", "needless to say",
    "unlock the power", "landscape of", "tapestry", "testament to",
)

REQUIRED_SECTIONS = {
    "executive summary": "Executive Summary",
    "key findings": "Key Findings",
    "methodology": "Methodology & Sources",
    "limitations": "Limitations",
}

EXEC_SUMMARY_MAX_WORDS = 250
KEY_FINDINGS_MIN = 3
KEY_FINDINGS_MAX = 7
MAX_HEADING_DEPTH = 3

_EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF⬀-⯿]"
)


@dataclass
class Finding:
    code: str
    message: str
    severity: str = "warn"   # "warn" | "error"


@dataclass
class Review:
    findings: list[Finding] = field(default_factory=list)

    def as_dicts(self) -> list[dict]:
        return [{"code": f.code, "message": f.message, "severity": f.severity} for f in self.findings]


def _section_level(blocks: list[Block]) -> int:
    """
    Which heading level carries the brief's top-level sections.

    Models are inconsistent: some emit '# Title' then '## Executive Summary',
    others make every section a '#'. Hardcoding a level silently disables
    every section check against the other convention, so it is derived — a
    lone heading at the shallowest level is the document title, and the
    sections sit one level in.
    """
    levels = sorted({b.level for b in blocks if b.type == "heading"})
    if not levels:
        return 1
    top = levels[0]
    at_top = sum(1 for b in blocks if b.type == "heading" and b.level == top)
    return levels[1] if at_top == 1 and len(levels) > 1 else top


def _sections(blocks: list[Block]) -> dict[str, list[Block]]:
    """Maps each section heading (lowercased) to the blocks beneath it."""
    level = _section_level(blocks)
    sections: dict[str, list[Block]] = {}
    current = None
    for block in blocks:
        if block.type == "heading" and block.level == level:
            current = block.text.lower().strip()
            sections[current] = []
        elif current is not None:
            sections[current].append(block)
    return sections


def _match_section(sections: dict[str, list[Block]], needle: str) -> list[Block] | None:
    for name, blocks in sections.items():
        if needle in name:
            return blocks
    return None


def _prose(blocks: list[Block]) -> str:
    """The readable text of a section, citations and markup removed — what a word count should see."""
    return " ".join(
        plain_text(strip_citations(block.text))
        for block in blocks if block.type in ("paragraph", "bullet", "quote", "caption")
    )


def review(markdown: str, blocks: list[Block], sources: list[dict]) -> Review:
    """Checks a parsed draft against the house spec. Never raises."""
    try:
        findings = _run_checks(markdown, blocks, sources)
    except Exception as e:  # a broken check must never break document generation
        findings = [Finding("review_failed", f"Review could not run: {e}")]
    return Review(findings)


def _run_checks(markdown: str, blocks: list[Block], sources: list[dict]) -> list[Finding]:
    findings: list[Finding] = []
    sections = _sections(blocks)

    # --- structure ---------------------------------------------------------
    if not sections:
        findings.append(Finding("no_headings", "Brief has no top-level sections.", "error"))

    for needle, label in REQUIRED_SECTIONS.items():
        if _match_section(sections, needle) is None:
            severity = "error" if needle == "limitations" else "warn"
            findings.append(Finding(
                f"missing_{needle.split()[0]}",
                f"Mandatory section missing: {label}.", severity,
            ))

    # Checked against the raw markdown: the parser clamps levels when it
    # builds Blocks, so by this point the over-deep heading is already gone.
    if re.search(r"^#{4,}\s", markdown, re.MULTILINE):
        findings.append(Finding("heading_depth", f"Headings nested deeper than {MAX_HEADING_DEPTH} levels."))

    # --- executive summary -------------------------------------------------
    summary = _match_section(sections, "executive summary")
    if summary is not None:
        words = len(_prose(summary).split())
        if words > EXEC_SUMMARY_MAX_WORDS:
            findings.append(Finding(
                "summary_too_long",
                f"Executive Summary is {words} words (limit {EXEC_SUMMARY_MAX_WORDS}).",
            ))
        elif words == 0:
            findings.append(Finding("summary_empty", "Executive Summary is empty.", "error"))

    # --- key findings ------------------------------------------------------
    key = _match_section(sections, "key findings")
    if key is not None:
        bullets = [b for b in key if b.type == "bullet"]
        if not KEY_FINDINGS_MIN <= len(bullets) <= KEY_FINDINGS_MAX:
            findings.append(Finding(
                "key_findings_count",
                f"Key Findings has {len(bullets)} items (expected {KEY_FINDINGS_MIN}-{KEY_FINDINGS_MAX}).",
            ))
        uncited = [b for b in bullets if not citation_numbers(b.text)]
        if uncited:
            findings.append(Finding(
                "uncited_findings",
                f"{len(uncited)} of {len(bullets)} key findings carry no citation.",
            ))

    # --- citations resolve -------------------------------------------------
    available = len([s for s in sources if (s.get("url") or "").strip()])
    cited: set[int] = set()
    for block in blocks:
        if block.type in ("paragraph", "bullet", "quote"):
            cited.update(citation_numbers(block.text))

    dangling = sorted(n for n in cited if n < 1 or n > available)
    if dangling:
        findings.append(Finding(
            "dangling_citation",
            f"Citations reference non-existent sources: {dangling} (only {available} available).",
            "error",
        ))
    if available and not cited:
        findings.append(Finding("no_citations", "Brief cites no sources at all.", "error"))
    elif available and not cited & set(range(1, available + 1)):
        # Citations exist, but every one of them dangles.
        findings.append(Finding("sources_unused", "No gathered source is cited in the text."))

    # --- tables referenced before they appear ------------------------------
    body_so_far: list[str] = []
    for block in blocks:
        if block.type == "table":
            caption = block.caption or ""
            label = re.match(r"^(Table\s+\d+)", caption, re.IGNORECASE)
            if not caption:
                findings.append(Finding("table_uncaptioned", "A table has no caption."))
            elif label and not any(label.group(1).lower() in t.lower() for t in body_so_far):
                findings.append(Finding(
                    "table_unreferenced",
                    f"{label.group(1)} is never referenced in the text before it appears.",
                ))
        elif block.type in ("paragraph", "bullet", "quote"):
            body_so_far.append(block.text)

    # --- tone --------------------------------------------------------------
    lowered = markdown.lower()
    hits = sorted({p for p in BANNED_PHRASES if p in lowered})
    if hits:
        findings.append(Finding("banned_phrase", f"Banned marketing/filler wording: {', '.join(hits)}."))

    if "!" in re.sub(r"https?://\S+", "", markdown):
        findings.append(Finding("exclamation", "Brief contains an exclamation mark."))

    if _EMOJI.search(markdown):
        findings.append(Finding("emoji", "Brief contains emoji."))

    # --- sourcing ----------------------------------------------------------
    if not available:
        findings.append(Finding("no_sources", "No sources were gathered for this brief.", "error"))

    return findings
