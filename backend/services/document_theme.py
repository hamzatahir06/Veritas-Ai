"""
Design tokens shared by every generated document.

Both writers import from here so the .pdf and the .docx can never drift into
looking like output from two different products. The PDF renderer consumes
these directly; the Word writer maps them onto Word styles, which is why
nothing in this module imports fpdf or python-docx.

Values follow the house formatting spec: US Letter, 1" margins, 11pt serif
body, headings bold and decreasing by level, black text plus exactly one
accent colour.
"""

import os

# --- page geometry (mm; fpdf2 is driven in mm) ------------------------------
PAGE_FORMAT = "Letter"
MARGIN = 25.4                     # 1 inch on all four sides
FOOTER_OFFSET = -15               # from page bottom, for the page number

# --- fonts ------------------------------------------------------------------
# Noto Serif is OFL-licensed and ships with the repo, so the PDF embeds a font
# we are actually allowed to redistribute (Georgia/Cambria/Times are not).
FONT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "fonts")
BODY_FAMILY = "NotoSerif"
BODY_FACES = {"": "NotoSerif-Regular.ttf", "B": "NotoSerif-Bold.ttf",
              "I": "NotoSerif-Italic.ttf", "BI": "NotoSerif-BoldItalic.ttf"}

# Noto Serif's Latin subset omits a handful of math glyphs that research prose
# genuinely uses (U+2248 approx, U+2264/5 lte/gte, U+2192 arrow). DejaVu Sans
# covers all of them, so it is registered as a fallback rather than letting
# those characters render as blanks.
FALLBACK_FAMILY = "DejaVuSans"
FALLBACK_FACE = "DejaVuSans.ttf"

# --- type scale (pt) --------------------------------------------------------
SIZE_TITLE = 22
SIZE_SUBTITLE = 12
SIZE_H1 = 15
SIZE_H2 = 12.5
SIZE_H3 = 11.5
SIZE_BODY = 11
SIZE_TABLE = 9.5
SIZE_CAPTION = 9.5
SIZE_FOOTER = 9
SIZE_REFERENCE = 10

HEADING_SIZES = {1: SIZE_H1, 2: SIZE_H2, 3: SIZE_H3}
HEADING_STYLES = {1: "B", 2: "B", 3: "BI"}

# --- vertical rhythm (mm) ---------------------------------------------------
# ~1.3 line spacing at 11pt, with 6-9pt of space after paragraphs.
LINE = 5.6
PARA_SPACE = 2.4
HEADING_SPACE_BEFORE = {1: 7.0, 2: 5.0, 3: 4.0}
HEADING_SPACE_AFTER = {1: 3.0, 2: 2.2, 3: 1.8}
BULLET_INDENT = 6.0
QUOTE_INDENT = 8.0

# --- colour -----------------------------------------------------------------
# Spec: black text plus at most one accent. INK is the near-black used for all
# running text and headings; BRAND is the single accent, spent only on rules
# and the title block so the document never reads as marketing collateral.
INK = (0x1A, 0x2B, 0x28)
BRAND = (0x35, 0xB6, 0x9E)
MUTED = (0x6B, 0x7A, 0x77)
RULE = (0xD9, 0xE0, 0xDE)
LINK = (0x11, 0x55, 0xCC)

# --- document conventions ---------------------------------------------------
DOC_KIND = "Research Brief"
AUTHOR = "Veritas AI"
TOC_PAGE_THRESHOLD = 10           # spec: add a TOC only past ~10 pages

# --- Word -------------------------------------------------------------------
# A .docx references fonts by name instead of embedding them, so the body face
# has to be one the reader's Word already has — which rules out the Noto Serif
# vendored for the PDF. Cambria is a ClearType serif that ships with Office and
# is named in the house spec.
WORD_BODY_FAMILY = "Cambria"
WORD_MONO_FAMILY = "Consolas"
WORD_LINE_SPACING = 1.2
WORD_SPACE_AFTER = 6              # pt after body paragraphs

# Word paginates on the reader's machine, so the spec's "TOC past ~10 pages"
# must be judged before layout: ~450 words per Letter page at 11pt / 1.2.
WORD_TOC_WORD_THRESHOLD = 4500


def body_face_paths() -> dict:
    """style -> absolute .ttf path for the four body faces."""
    return {style: os.path.join(FONT_DIR, name) for style, name in BODY_FACES.items()}


def fallback_face_path() -> str:
    return os.path.join(FONT_DIR, FALLBACK_FACE)
