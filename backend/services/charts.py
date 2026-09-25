"""
Bar charts drawn from the brief's own tables — never from anything else.

The model only ever writes tables of sourced numbers; whether one becomes a
chart is decided here, deterministically. chart_from_table() is a strict gate:
a table is charted only when it is unambiguously "one measure across items",
so a chart can never imply a comparison the data doesn't support (mixed units,
several measures, a time axis mistaken for values). Anything else stays a table.

The chart sits under its table rather than replacing it, so every plotted value
is still printed exactly as the source gave it. Bars are labelled with the
original cell text for the same reason — the chart never reformats a number.

Drawn with Pillow (already a dependency) so both writers embed the same PNG.
"""

import io
import re
from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFont

from services import document_theme as T
from services.document_common import Block, plain_text

MIN_ROWS, MAX_ROWS = 3, 12

# One value: optional leading currency, a non-negative number, optional
# trailing % or currency. Anything else ("~9", "n/a", "3-5", "−2") disqualifies
# the whole table — an approximate or ranged value can't be drawn honestly.
_VALUE = re.compile(r"([€£$¥]?)\s*\+?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*([%€£$¥]?)")
_TABLE_PREFIX = re.compile(r"^Table\s+\d+\s*[:.]\s*", re.IGNORECASE)


@dataclass
class Chart:
    labels: list[str]
    values: list[float]
    texts: list[str]     # each value exactly as the table printed it
    measure: str         # the numeric column's heading, e.g. "Adoption (%)"
    caption: str         # figure caption, without the "Figure n:" prefix


def _parse(text: str) -> tuple[float, str] | None:
    """(value, unit) for a clean single value, else None."""
    m = _VALUE.fullmatch(text)
    if not m:
        return None
    prefix, whole, fraction, suffix = m.groups()
    if prefix and suffix:
        return None
    return float(whole.replace(",", "") + (fraction or "")), prefix or suffix


def chart_from_table(block: Block) -> Chart | None:
    """A Chart when the table is exactly one labelled measure, else None."""
    if len(block.header) != 2 or not MIN_ROWS <= len(block.rows) <= MAX_ROWS:
        return None
    label_header, measure = (plain_text(h).strip() for h in block.header)
    if "year" in measure.lower():
        return None

    labels, values, texts, units = [], [], [], set()
    for row in block.rows:
        label, text = (plain_text(cell).strip() for cell in row)
        parsed = _parse(text)
        if not label or parsed is None or _parse(label) is not None:
            return None  # a numeric label column means this isn't "items vs. one measure"
        value, unit = parsed
        labels.append(label)
        values.append(value)
        texts.append(text)
        units.add(unit)

    if len(units) != 1 or max(values) <= 0:
        return None
    # Bare four-digit integers in 1900-2100 are years, not a measure.
    if not units.pop() and all(v.is_integer() and 1900 <= v <= 2100 for v in values):
        return None

    caption = _TABLE_PREFIX.sub("", plain_text(block.caption).strip())
    return Chart(labels, values, texts, measure,
                 caption or f"{measure} by {label_header.lower()}")


# --------------------------------------------------------------------------
# drawing
# --------------------------------------------------------------------------

DPI = 220


def _px(points: float) -> int:
    return round(points / 72 * DPI)


def _font(size_pt: float):
    return ImageFont.truetype(T.body_face_paths()[""], _px(size_pt))


def _wrap(draw, text: str, font, width: int, max_lines: int = 2) -> list[str]:
    """Greedy word wrap to a pixel width; the last line ellipsised if needed."""
    lines: list[str] = []
    for word in text.split():
        if lines and draw.textlength(f"{lines[-1]} {word}", font=font) <= width:
            lines[-1] += f" {word}"
        else:
            lines.append(word)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] += "…"
    while draw.textlength(lines[-1], font=font) > width:
        lines[-1] = lines[-1][:-2] + "…"
    return lines


def render_png(chart: Chart, width_mm: float) -> bytes:
    """Horizontal bar chart, sized to the text column, as PNG bytes."""
    width = round(width_mm / 25.4 * DPI)
    text_font, measure_font = _font(T.SIZE_TABLE), _font(T.SIZE_CAPTION)
    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))

    line_h = round(_px(T.SIZE_TABLE) * 1.25)
    pad = _px(6)
    label_w = round(width * 0.34)
    value_w = max(round(probe.textlength(t, font=text_font)) for t in chart.texts) + pad
    bar_x0 = label_w + pad
    bar_span = width - bar_x0 - value_w - pad

    wrapped = [_wrap(probe, label, text_font, label_w) for label in chart.labels]
    row_h = [max(len(lines) * line_h, _px(14)) + _px(6) for lines in wrapped]
    top = _px(T.SIZE_CAPTION) + _px(8)
    height = top + sum(row_h) + pad

    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    draw.text((bar_x0, 0), chart.measure, font=measure_font, fill=T.MUTED)

    peak = max(chart.values)
    y = top
    for lines, value, text, h in zip(wrapped, chart.values, chart.texts, row_h):
        block_h = len(lines) * line_h
        for n, line in enumerate(lines):
            line_w = draw.textlength(line, font=text_font)
            draw.text((label_w - line_w, y + (h - block_h) / 2 + n * line_h),
                      line, font=text_font, fill=T.INK)
        bar_h = _px(11)
        bar_top = y + (h - bar_h) / 2
        bar_end = bar_x0 + max(1, round(bar_span * value / peak))
        draw.rectangle((bar_x0, bar_top, bar_end, bar_top + bar_h), fill=T.BRAND)
        draw.text((bar_end + _px(4), y + (h - line_h) / 2), text, font=text_font, fill=T.INK)
        y += h

    # Zero baseline: every bar starts from it, so lengths compare honestly.
    draw.line((bar_x0, top - _px(2), bar_x0, y), fill=T.MUTED, width=max(1, _px(0.6)))

    out = io.BytesIO()
    image.save(out, format="PNG", dpi=(DPI, DPI))
    return out.getvalue()
