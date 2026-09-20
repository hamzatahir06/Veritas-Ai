# Vendored fonts

These `.ttf` files are third-party works, redistributed here so the PDF writer
can embed a font it is guaranteed to find at runtime. They are **not** covered
by the repository's MIT license — each keeps its own terms, reproduced in full
alongside it.

| Files | Family | Version | License | Full text |
| ----- | ------ | ------- | ------- | --------- |
| `NotoSerif-{Regular,Bold,Italic,BoldItalic}.ttf` | Noto Serif | 2.015 | SIL Open Font License 1.1 | [`LICENSE-NotoSerif-OFL.txt`](LICENSE-NotoSerif-OFL.txt) |
| `DejaVuSans.ttf` | DejaVu Sans | 2.37 | Bitstream Vera / Arev (public-domain changes) | [`LICENSE-DejaVu.txt`](LICENSE-DejaVu.txt) |

Copyright holders, as declared in each file's `name` table:

- Noto Serif — Copyright 2022 The Noto Project Authors
  (<https://github.com/notofonts/latin-greek-cyrillic>)
- DejaVu Sans — Copyright (c) 2003 Bitstream, Inc.; Arev glyphs
  Copyright (c) 2006 Tavmjong Bah; DejaVu's own changes are public domain

## Why both

Noto Serif is the body face for every generated PDF — see
`backend/services/document_theme.py`. Its Latin subset omits a few math glyphs
that research prose actually uses (`≈`, `≤`, `≥`, `→`), so DejaVu Sans is
registered as a narrow fallback for exactly those characters.

Both licenses permit redistribution as done here. The OFL additionally
requires that the license travel with the font files, which is what
`LICENSE-NotoSerif-OFL.txt` is for — don't remove it, and don't rename the
font files to a name containing "Noto" if you modify them (OFL reserved-name
clause).
