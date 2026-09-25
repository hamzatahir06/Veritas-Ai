"""
Shared markdown parsing for both docx_writer.py and pdf_writer.py — one
parser, two renderers, so neither writer duplicates parsing logic.

Two layers:
  * parse_markdown() -> [Block]  — block structure (headings, lists, tables…)
  * parse_inline()   -> [Run]    — character runs inside a block's text

Renderers walk Blocks and ask parse_inline() for the runs of any text they
draw. Documents carry no in-text citations (strip_citations() runs first);
citation runs exist for services/brief_review.py, which checks them.

The '## Sources' / '## References' section the model emits is skipped
entirely: the real reference list is always rebuilt from actual search
results by build_references(), never trusted to the model.
"""

import re
from dataclasses import dataclass, field
from datetime import date

from agent.tools import domain_of

_CITATION_ARTIFACT_PATTERN = re.compile(r"【[^】]*】")

# Headings the model may write that we always rebuild ourselves.
_MODEL_OWNED_HEADINGS = {"sources", "references", "reference list", "bibliography", "works cited"}

# A leading "2." / "3.1" / "4.1.1." the model wrote into a heading. Section
# numbers are assigned by the renderer so they stay gapless even when the
# model skips or repeats one.
_LEADING_SECTION_NUMBER = re.compile(r"^\d+(?:\.\d+)*\.?\s+")

_ORDERED_ITEM = re.compile(r"^(\d+)[.)]\s+(.*)$")
_CAPTION = re.compile(r"^(Table|Figure)\s+\d+\s*[:.]", re.IGNORECASE)
_RULE = re.compile(r"^(-{3,}|\*{3,}|_{3,})$")

# One IEEE marker: "[3]" or "[1, 4]".
_CITE = r"\[\d+(?:\s*,\s*\d+)*\]"

# Inline markers, matched in one pass. Order matters: code spans win over
# everything, links are consumed before bare citation brackets so that
# "[text](url)" is never mistaken for a citation, and bold is tried before
# italic so "**x**" doesn't parse as an empty italic.
_INLINE = re.compile(
    r"(?P<code>`[^`\n]+`)"
    r"|(?P<link>\[[^\]\n]+\]\([^)\s]+\))"
    r"|(?P<bold>\*\*[^\n]+?\*\*)"
    r"|(?P<italic>(?<!\*)\*(?!\s)[^*\n]+?(?<!\s)\*(?!\*))"
    rf"|(?P<cite>{_CITE})"
)


# A run of IEEE markers plus the space before it: " [16], [17]" / " [1, 4]".
# Never a markdown link "[1](url)".
_CITATION_GROUP = re.compile(rf"\s*{_CITE}(?:\s*,?\s*{_CITE})*(?!\()")


def strip_citations(markdown: str) -> str:
    """
    Removes in-text citation markers; the documents print no [n] in the body.

    Done on the raw text, before parsing, so a whole group goes with the space
    before it and the sentence keeps its own punctuation: "rose [2]." -> "rose.".
    """
    return _CITATION_GROUP.sub("", markdown)


def clean(text: str) -> str:
    """Strips citation-marker artifacts models sometimes emit unprompted."""
    return _CITATION_ARTIFACT_PATTERN.sub("", text).strip()


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return slug[:60] or "research-brief"


def document_filename(topic: str, extension: str, today: date | None = None) -> str:
    """
    Spec filename shape: 2026-09_topic-slug_Research-Brief.pdf

    Dated first so a folder of briefs sorts chronologically, and the kind is
    spelled out so the file is identifiable once detached from the app.
    """
    today = today or date.today()
    return f"{today:%Y-%m}_{_slugify(topic)}_Research-Brief.{extension.lstrip('.')}"


# --------------------------------------------------------------------------
# inline runs
# --------------------------------------------------------------------------

@dataclass
class Run:
    text: str
    bold: bool = False
    italic: bool = False
    code: bool = False
    link: str = ""          # target URL when this run is a hyperlink
    citation: bool = False  # an IEEE marker like "[3]" or "[1], [4]"


def parse_inline(text: str) -> list[Run]:
    """Splits a block's text into styled runs. Always returns at least one run."""
    text = clean(text)
    runs: list[Run] = []
    pos = 0

    for m in _INLINE.finditer(text):
        if m.start() > pos:
            runs.append(Run(text[pos:m.start()]))
        kind = m.lastgroup
        raw = m.group()
        if kind == "code":
            runs.append(Run(raw[1:-1], code=True))
        elif kind == "link":
            label, _, target = raw[1:].partition("](")
            runs.append(Run(label, link=target.rstrip(")")))
        elif kind == "bold":
            runs.append(Run(raw[2:-2], bold=True))
        elif kind == "italic":
            runs.append(Run(raw[1:-1], italic=True))
        else:  # citation
            runs.append(Run(raw, citation=True))
        pos = m.end()

    if pos < len(text):
        runs.append(Run(text[pos:]))
    return runs or [Run(text)]


def plain_text(text: str) -> str:
    """A block's text without its markup — bold/italic/code markers dropped, links as their label."""
    return "".join(run.text for run in parse_inline(text))


def citation_numbers(text: str) -> list[int]:
    """Every source number cited in a piece of text, e.g. '[1], [4]' -> [1, 4]."""
    found: list[int] = []
    for run in parse_inline(text):
        if run.citation:
            found.extend(int(n) for n in re.findall(r"\d+", run.text))
    return found


# --------------------------------------------------------------------------
# block structure
# --------------------------------------------------------------------------

@dataclass
class Block:
    # "heading" | "paragraph" | "bullet" | "table" | "caption" | "quote" | "rule"
    type: str
    text: str = ""
    level: int = 1
    ordered: bool = False
    marker: str = ""
    header: list[str] = field(default_factory=list)
    rows: list[list[str]] = field(default_factory=list)
    caption: str = ""


def _is_table_row(line: str) -> bool:
    return line.startswith("|") and line.endswith("|")


def _parse_table_row(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def _is_table_separator(line: str) -> bool:
    return all(re.fullmatch(r":?-+:?", c) for c in _parse_table_row(line) if c)


def _heading(line: str, hashes: int) -> Block | None:
    text = clean(line[hashes + 1:])
    if text.lower().rstrip(":").strip() in _MODEL_OWNED_HEADINGS:
        return None
    return Block(type="heading", level=min(hashes, 3), text=_LEADING_SECTION_NUMBER.sub("", text))


def parse_markdown(markdown: str) -> list[Block]:
    """
    Parses the model's markdown into Blocks.

    Consecutive plain lines are joined into a single paragraph — a model that
    hard-wraps its prose would otherwise produce one stranded Block per line,
    which renders as a column of disconnected fragments.
    """
    lines = markdown.strip().splitlines()
    n = len(lines)
    blocks: list[Block] = []
    paragraph: list[str] = []
    skipping = False
    i = 0

    def flush():
        if paragraph:
            joined = " ".join(paragraph).strip()
            paragraph.clear()
            if joined:
                kind = "caption" if _CAPTION.match(joined) else "paragraph"
                blocks.append(Block(type=kind, text=joined))

    while i < n:
        raw = lines[i]
        line = raw.strip()
        indent = len(raw) - len(raw.lstrip(" "))

        if not line:
            flush()
            i += 1
            continue

        hashes = len(line) - len(line.lstrip("#"))
        if 1 <= hashes <= 6 and line[hashes:hashes + 1] == " ":
            flush()
            block = _heading(line, hashes)
            # A model-owned heading swallows its body too, up to the next heading.
            skipping = block is None
            if block:
                blocks.append(block)
            i += 1
            continue

        if skipping:
            i += 1
            continue

        if _RULE.match(line):
            flush()
            blocks.append(Block(type="rule"))
            i += 1
            continue

        if _is_table_row(line) and i + 1 < n and _is_table_separator(lines[i + 1].strip()):
            flush()
            header = _parse_table_row(line)
            i += 2
            rows = []
            while i < n and _is_table_row(lines[i].strip()):
                # Models write ragged rows; every renderer needs one cell per
                # column, so pad short rows and drop cells past the header.
                cells = _parse_table_row(lines[i].strip())[:len(header)]
                rows.append(cells + [""] * (len(header) - len(cells)))
                i += 1
            # Spec puts a table's caption above it, so a caption paragraph
            # immediately before the table belongs to it.
            caption = ""
            if blocks and blocks[-1].type == "caption":
                caption = blocks.pop().text
            blocks.append(Block(type="table", header=header, rows=rows, caption=caption))
            continue

        if line.startswith("> "):
            flush()
            blocks.append(Block(type="quote", text=line[2:]))
            i += 1
            continue

        if line.startswith(("- ", "* ", "+ ")):
            flush()
            blocks.append(Block(type="bullet", level=2 if indent >= 2 else 1, text=line[2:]))
            i += 1
            continue

        ordered = _ORDERED_ITEM.match(line)
        if ordered:
            flush()
            blocks.append(Block(
                type="bullet", level=2 if indent >= 2 else 1,
                text=ordered.group(2), ordered=True, marker=f"{ordered.group(1)}.",
            ))
            i += 1
            continue

        paragraph.append(line)
        i += 1

    flush()
    return blocks


# --------------------------------------------------------------------------
# structure helpers shared by both renderers
# --------------------------------------------------------------------------

class SectionNumberer:
    """
    Assigns gapless 1 / 1.1 / 1.1.1 numbers as headings stream past.

    Numbering is decided here rather than taken from the model, so it can
    never skip or repeat, and both writers produce the same numbers for the
    same brief — a reader comparing the PDF and the .docx must not find
    section 5.2 in different places.
    """

    def __init__(self, depth: int = 3):
        self._counters = [0] * depth

    def next(self, level: int) -> str:
        index = min(max(level, 1), len(self._counters)) - 1
        self._counters[index] += 1
        for deeper in range(index + 1, len(self._counters)):
            self._counters[deeper] = 0
        return ".".join(str(c) for c in self._counters[:index + 1])


def ends_list(blocks: list[Block], i: int) -> bool:
    """Whether blocks[i] is the last item of its list — lists sit tight inside, then get a paragraph gap."""
    return i + 1 == len(blocks) or blocks[i + 1].type != "bullet"


def normalise_headings(blocks: list[Block]) -> list[Block]:
    """
    Drops the model's own H1 and re-bases what remains so the shallowest
    heading is level 1.

    The title is rendered from the topic on the title page, so the model's
    copy of it is removed. Models then write sections as '##' beneath it,
    which without re-basing numbers them 0.1, 0.2 — the level-1 counter never
    advances — and suppresses any styling reserved for a top-level heading.
    """
    if blocks and blocks[0].type == "heading" and blocks[0].level == 1 and len(blocks) > 1:
        blocks = blocks[1:]

    levels = [b.level for b in blocks if b.type == "heading"]
    shift = (min(levels) - 1) if levels else 0
    if shift:
        for block in blocks:
            if block.type == "heading":
                block.level = max(1, block.level - shift)
    return blocks


_NUMERIC_CELL = re.compile(r"[%€£$¥]?\s*[-+]?[\d,.]+\s*[%€£$¥]?")


def numeric_columns(header: list[str], rows: list[list[str]]) -> list[bool]:
    """
    Which table columns hold numbers, so a renderer can right-align them.

    Judged from the body rows only — a numeric column's heading is usually a
    word ("Cost/kWh"). A currency symbol may lead ($310) or trail (310€).
    """
    flags = []
    for col in range(len(header)):
        values = [r[col].strip() for r in rows if col < len(r) and r[col].strip()]
        flags.append(bool(values) and all(_NUMERIC_CELL.fullmatch(v) for v in values))
    return flags


# --------------------------------------------------------------------------
# references
# --------------------------------------------------------------------------

@dataclass
class Reference:
    index: int
    text: str   # everything except the URL, already IEEE-shaped
    url: str


def _year_of(source: dict) -> str:
    published = str(source.get("published") or "").strip()
    match = re.search(r"(?:19|20)\d{2}", published)
    return match.group() if match else ""


def build_references(sources: list[dict]) -> list[Reference]:
    """
    Builds the IEEE reference list from real search results.

    Degrades field by field: scholarly hits carry authors/venue/date, while a
    plain web result often has only a title and URL. Every branch still
    produces a usable entry rather than printing empty punctuation.
    """
    references: list[Reference] = []
    seen: set[str] = set()

    for source in sources:
        url = (source.get("url") or "").strip()
        if not url or url in seen:
            continue
        seen.add(url)

        # The publishing domain stands in as the title for a result that has none.
        title = clean(source.get("title") or "") or domain_of(url) or url
        authors = clean(source.get("authors") or "")
        venue = clean(source.get("venue") or "")
        year = _year_of(source)

        # IEEE: A. Author, "Title," Venue, Year.  Punctuation is decided by
        # what survives, so a bare web hit never prints an empty field or a
        # doubled full stop.
        tail = ", ".join(p for p in (venue, year) if p)
        segments = []
        if authors:
            segments.append(f"{authors.rstrip(' ,')},")
        bare_title = title.strip().rstrip(" .")
        segments.append(f'"{bare_title},"' if tail else f'"{bare_title}."')
        if tail:
            segments.append(f"{tail}.")

        references.append(Reference(index=len(references) + 1, text=" ".join(segments), url=url))

    return references
