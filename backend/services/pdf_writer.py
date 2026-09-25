"""
Renders a parsed research brief into a professional-grade PDF.

Shares its parser (services/document_common.py) and its design tokens
(services/document_theme.py) with the Word writer — only the drawing lives
here.

Notable choices, all of them load-bearing:

* Noto Serif is embedded from the repo with DejaVu Sans registered as a
  fallback, so the output is fully searchable and no character is ever
  silently dropped. There is deliberately no "sanitize to Latin-1" step.
* Section numbers (1, 1.1, 1.1.1) are assigned here, not taken from the
  model, so they are always gapless and never exceed three levels.
* Headings are drawn by hand and `start_section` is used only to build the
  PDF outline. Handing headings to `set_section_title_styles` would render
  them too, which fights the brand rule drawn under each level-1 heading.
* Every full-width write passes new_x="LMARGIN". fpdf2 parks the cursor at
  the right edge after a w=0 cell, and the next full-width write would then
  compute zero available width and raise.
* The TOC is decided by rendering once to count pages — the spec only wants
  one past ~10 pages, and page count isn't knowable before layout.
"""

import io
import os
from datetime import date

from fpdf import FPDF
from fpdf.enums import TableBordersLayout
from fpdf.fonts import FontFace
from PIL import Image

from agent.core import ResearchResult
from services import document_theme as T
from services.charts import Chart, chart_from_table, render_png
from services.document_common import (
    Block, Run, SectionNumberer, build_references, clean, document_filename,
    ends_list, normalise_headings, numeric_columns, parse_inline, parse_markdown, strip_citations,
)

PT_TO_MM = 25.4 / 72


class BriefPDF(FPDF):
    """FPDF with a running footer and the brief's own typographic helpers."""

    def __init__(self):
        super().__init__(format=T.PAGE_FORMAT, unit="mm")
        self.set_margins(T.MARGIN, T.MARGIN, T.MARGIN)
        self.set_auto_page_break(auto=True, margin=T.MARGIN)
        for style, path in T.body_face_paths().items():
            self.add_font(T.BODY_FAMILY, style=style, fname=path)
        self.add_font(T.FALLBACK_FAMILY, fname=T.fallback_face_path())
        self.set_fallback_fonts([T.FALLBACK_FAMILY])
        self.set_font(T.BODY_FAMILY, size=T.SIZE_BODY)

    # -- chrome ------------------------------------------------------------
    def footer(self):
        # Spec: page numbers only, and none on the title page.
        if self.page_no() == 1:
            return
        self.set_y(T.FOOTER_OFFSET)
        self.set_font(T.BODY_FAMILY, size=T.SIZE_FOOTER)
        self.set_text_color(*T.MUTED)
        self.cell(0, 10, str(self.page_no()), align="C")
        self.set_text_color(*T.INK)

    # -- primitives --------------------------------------------------------
    @property
    def usable_width(self) -> float:
        return self.w - self.l_margin - self.r_margin

    def text_block(self, text: str, *, style: str = "", size: float = T.SIZE_BODY,
                   height: float = T.LINE, color: tuple = T.INK):
        self.set_x(self.l_margin)
        self.set_font(T.BODY_FAMILY, style=style, size=size)
        self.set_text_color(*color)
        self.multi_cell(self.usable_width, height, text,
                        align="L", new_x="LMARGIN", new_y="NEXT")

    def rich_block(self, runs: list[Run], *, indent: float = 0.0,
                   base_style: str = "", color: tuple = T.INK):
        """
        Draws styled runs as one flowing paragraph.

        Laid out as a single text_columns() paragraph rather than one write()
        per run: write() wraps each run on its own, so a run that starts with
        an unbreakable token near the line end ("44 %", joined by a narrow
        no-break space) got split character by character — "4" / "4 %".
        """
        with self.text_columns(l_margin=self.l_margin + indent,
                               line_height=T.LINE / (T.SIZE_BODY * PT_TO_MM)) as columns:
            with columns.paragraph() as paragraph:
                for run in runs:
                    style = base_style
                    if run.bold and "B" not in style:
                        style += "B"
                    if run.italic and "I" not in style:
                        style += "I"
                    if run.link:
                        self.set_text_color(*T.LINK)
                        self.set_font(T.BODY_FAMILY, style=style + "U", size=T.SIZE_BODY)
                        paragraph.write(run.text, link=run.link)
                    else:
                        self.set_text_color(*color)
                        self.set_font(T.BODY_FAMILY, style=style,
                                      size=T.SIZE_BODY * (0.92 if run.code else 1))
                        paragraph.write(run.text)
        self.set_x(self.l_margin)
        self.set_text_color(*T.INK)

    def rule(self, width: float | None = None, color: tuple = T.RULE, thickness: float = 0.4):
        self.set_draw_color(*color)
        self.set_line_width(thickness)
        y = self.get_y()
        self.line(self.l_margin, y, self.l_margin + (width or self.usable_width), y)
        self.ln(1.5)

    def keep_with_next(self, needed: float):
        """Orphan control: never strand a heading at the foot of a page."""
        if self.will_page_break(needed):
            self.add_page()


# --------------------------------------------------------------------------
# rendering
# --------------------------------------------------------------------------

def _title_page(pdf: BriefPDF, result: ResearchResult, today: date):
    pdf.add_page()
    pdf.ln(55)
    pdf.rule(width=32, color=T.BRAND, thickness=1.2)
    pdf.ln(4)
    pdf.text_block(clean(result.topic), style="B", size=T.SIZE_TITLE, height=10)
    pdf.ln(2)
    pdf.text_block(T.DOC_KIND, style="I", size=T.SIZE_SUBTITLE, color=T.MUTED)
    pdf.ln(3)
    pdf.text_block(f"{T.AUTHOR}  ·  {today:%d %B %Y}", size=T.SIZE_CAPTION, color=T.MUTED)


def _render_toc(pdf: FPDF, outline):
    pdf.set_x(pdf.l_margin)
    pdf.set_font(T.BODY_FAMILY, style="B", size=T.SIZE_H1)
    pdf.set_text_color(*T.INK)
    pdf.multi_cell(0, 8, "Contents", align="L", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    for section in outline:
        pdf.set_x(pdf.l_margin)
        pdf.set_font(T.BODY_FAMILY, style="B" if section.level == 0 else "", size=T.SIZE_REFERENCE)
        link = pdf.add_link(page=section.page_number)
        label = f"{'    ' * section.level}{section.name}"
        pdf.cell(pdf.w - pdf.l_margin - pdf.r_margin - 12, 5.8, label,
                 align="L", link=link, new_x="RIGHT", new_y="TOP")
        pdf.cell(12, 5.8, str(section.page_number), align="R", link=link,
                 new_x="LMARGIN", new_y="NEXT")


def _section_heading(pdf: BriefPDF, label: str, level: int):
    """
    One numbered heading: outline entry, text, and its rule — the accent
    colour under sections, a thin grey one under subsections.
    """
    size = T.HEADING_SIZES[level]
    pdf.keep_with_next(T.HEADING_SPACE_BEFORE[level] + size * 0.5 + T.LINE * 2)
    pdf.ln(T.HEADING_SPACE_BEFORE[level])
    pdf.start_section(label, level=level - 1, strict=False)
    pdf.text_block(label, style=T.HEADING_STYLES[level], size=size, height=size * 0.45)
    if level == 1:
        pdf.rule(color=T.BRAND, thickness=0.6)
    elif level == 2:
        pdf.rule(color=T.RULE, thickness=0.3)
    pdf.ln(T.HEADING_SPACE_AFTER[level])


def _bullet(pdf: BriefPDF, block: Block):
    indent = T.BULLET_INDENT * block.level
    marker = block.marker if block.ordered else "•"
    pdf.set_x(pdf.l_margin + indent - T.BULLET_INDENT)
    pdf.set_font(T.BODY_FAMILY, size=T.SIZE_BODY)
    pdf.set_text_color(*T.INK)
    pdf.cell(T.BULLET_INDENT, T.LINE, marker, new_x="RIGHT", new_y="TOP")
    pdf.rich_block(parse_inline(block.text), indent=indent)
    pdf.ln(T.BULLET_GAP)


def _table(pdf: BriefPDF, block: Block):
    if not block.header:
        return
    # Spec: a table's caption sits above it and must make sense alone.
    if block.caption:
        # Never strand the caption at a page foot: keep it with the heading
        # row and the first couple of body rows.
        pdf.keep_with_next(T.LINE * 5)
        pdf.ln(1.5)
        pdf.text_block(clean(block.caption), style="I", size=T.SIZE_CAPTION, color=T.MUTED)
        pdf.ln(0.8)

    # Numeric columns right-align; everything else left. Judged from the body
    # rows so a numeric column with a word heading still aligns correctly.
    aligns, widths = [], []
    for col, is_numeric in enumerate(numeric_columns(block.header, block.rows)):
        aligns.append("RIGHT" if is_numeric else "LEFT")
        # Relative weights, so a label column isn't squeezed to the same width
        # as a two-digit year. Clamped so one long cell can't starve the rest.
        cells = [block.header[col]] + [r[col] for r in block.rows if col < len(r)]
        widths.append(max(6, min(40, max(len(clean(c)) for c in cells))))

    pdf.set_font(T.BODY_FAMILY, size=T.SIZE_TABLE)
    pdf.set_draw_color(*T.RULE)
    pdf.set_text_color(*T.INK)
    with pdf.table(
        borders_layout=TableBordersLayout.HORIZONTAL_LINES,
        headings_style=FontFace(emphasis="B", color=T.INK),
        text_align=tuple(aligns),
        col_widths=tuple(widths),
        line_height=T.LINE * 0.85,
        padding=1.6,
        repeat_headings=1,
    ) as table:
        row = table.row()
        for cell in block.header:
            row.cell(clean(cell))
        for data in block.rows:
            row = table.row()
            for cell in data:
                row.cell(clean(cell))
    pdf.ln(T.PARA_SPACE)


def _figure(pdf: BriefPDF, chart: Chart, number: int):
    """A chart under its table, captioned below as figures conventionally are."""
    png = render_png(chart, pdf.usable_width)
    with Image.open(io.BytesIO(png)) as image:
        height = pdf.usable_width * image.height / image.width
    pdf.keep_with_next(height + T.LINE * 2)  # never split a figure from its caption
    pdf.image(io.BytesIO(png), x=pdf.l_margin, w=pdf.usable_width, h=height)
    pdf.ln(1)
    pdf.text_block(f"Figure {number}: {chart.caption}", style="I",
                   size=T.SIZE_CAPTION, color=T.MUTED)
    pdf.ln(T.PARA_SPACE)


def _references(pdf: BriefPDF, result: ResearchResult, numberer: SectionNumberer):
    references = build_references(result.sources)
    _section_heading(pdf, f"{numberer.next(1)}  References", 1)

    if not references:
        pdf.text_block("No sources were recorded for this brief.", color=T.MUTED)
        return

    # IEEE reference entries hang under their own bracketed number.
    base_margin = pdf.l_margin
    hanging = 10.0
    for ref in references:
        pdf.keep_with_next(T.LINE * 2)
        pdf.set_x(base_margin)
        pdf.set_font(T.BODY_FAMILY, style="B", size=T.SIZE_REFERENCE)
        pdf.set_text_color(*T.INK)
        pdf.cell(hanging, T.LINE, f"[{ref.index}]", new_x="RIGHT", new_y="TOP")
        pdf.set_left_margin(base_margin + hanging)
        pdf.set_x(pdf.l_margin)
        pdf.set_font(T.BODY_FAMILY, size=T.SIZE_REFERENCE)
        pdf.write(T.LINE, f"{ref.text} [Online]. Available: ")
        pdf.set_text_color(*T.LINK)
        pdf.set_font(T.BODY_FAMILY, style="U", size=T.SIZE_REFERENCE)
        pdf.write(T.LINE, ref.url, link=ref.url)
        pdf.ln(T.LINE)
        pdf.set_left_margin(base_margin)
        pdf.set_text_color(*T.INK)
        pdf.ln(1.2)


def _render(result: ResearchResult, *, with_toc: bool, today: date) -> BriefPDF:
    pdf = BriefPDF()
    topic = clean(result.topic)
    pdf.set_title(f"{topic} — {T.DOC_KIND}")
    pdf.set_author(T.AUTHOR)
    pdf.set_subject(T.DOC_KIND)
    pdf.set_creator(T.AUTHOR)
    pdf.set_keywords(", ".join(filter(None, [topic, "research brief", result.provider])))

    _title_page(pdf, result, today)
    pdf.add_page()
    if with_toc:
        pdf.insert_toc_placeholder(_render_toc, pages=1, allow_extra_pages=True)

    numberer = SectionNumberer()
    blocks = normalise_headings(parse_markdown(strip_citations(result.markdown)))
    figures = 0

    for i, block in enumerate(blocks):
        if block.type == "heading":
            level = min(block.level, 3)
            _section_heading(pdf, f"{numberer.next(level)}  {block.text}", level)
        elif block.type == "bullet":
            _bullet(pdf, block)
            if ends_list(blocks, i):
                pdf.ln(T.PARA_SPACE - T.BULLET_GAP)
        elif block.type == "table":
            _table(pdf, block)
            if chart := chart_from_table(block):
                figures += 1
                _figure(pdf, chart, figures)
        elif block.type == "caption":
            pdf.text_block(clean(block.text), style="I", size=T.SIZE_CAPTION, color=T.MUTED)
            pdf.ln(T.PARA_SPACE)
        elif block.type == "quote":
            pdf.rich_block(parse_inline(block.text), indent=T.QUOTE_INDENT,
                           base_style="I", color=T.MUTED)
            pdf.ln(T.PARA_SPACE)
        elif block.type == "rule":
            pdf.ln(1)
            pdf.rule()
            pdf.ln(1)
        else:
            pdf.rich_block(parse_inline(block.text))
            pdf.ln(T.PARA_SPACE)

    _references(pdf, result, numberer)
    return pdf


def build_pdf(result: ResearchResult, today: date | None = None) -> BriefPDF:
    """
    Renders the brief, adding a table of contents only when the document runs
    past the spec's ~10-page threshold. Page count isn't knowable until the
    document is laid out, so a throwaway pass measures it first.
    """
    today = today or date.today()
    probe = _render(result, with_toc=False, today=today)
    if probe.pages_count <= T.TOC_PAGE_THRESHOLD:
        return probe
    return _render(result, with_toc=True, today=today)


def save_research_as_pdf(result: ResearchResult, output_dir: str = "output") -> str:
    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, document_filename(result.topic, "pdf"))
    build_pdf(result).output(path)
    return path
