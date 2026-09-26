---
title: Download kits
description: Download any family as font files, CSS and a demo page to use without the CSS API.
---

# Download kits

A kit is a ZIP with everything needed to use a font as normal files: no API, no account, no server. Use it for projects that can't load fonts from Typeface Hub, for desktop apps, or for handing a font to another team.

## Getting a kit

Open a family and click **Download kit** (or scroll down its **Use** tab). Pick the options and click **Download ZIP**. The kit is built from the version you are viewing, so drafts can be downloaded before they are published.

## What's inside

```text
montserrat-webfont-kit/
├── fonts/
│   ├── montserrat-400.woff2
│   ├── montserrat-400.woff
│   └── montserrat-400.ttf
├── css/
│   ├── montserrat.css      @font-face rules and the fallback face
│   └── tokens.css          (optional) typography tokens
├── demo.html               playground and every combination with its CSS
└── README.txt              how to use it, and licence notes
```

## Using a kit

1. Copy `fonts/` and `css/` into your project, keeping them side by side (the CSS loads `../fonts/…` by default).
2. Add the stylesheet:

```html
<link rel="stylesheet" href="/css/montserrat.css">
```

3. Use the font:

```css
body { font-family: 'Montserrat', 'Montserrat Fallback', system-ui, sans-serif; }
```

## Options

| Option | Choices |
| --- | --- |
| Formats | WOFF2 (all modern browsers), WOFF (older browsers), TTF/OTF (desktop apps, email, native) |
| Faces | Any subset of the family's faces |
| Characters | Latin + Latin Extended (default), Basic Latin only, split by script, full font, or only the characters you type |
| Variable fonts | Keep as variable, or export static weights |
| Axes | For each axis: keep the full range, limit a range, or pin a value |
| Font path | The path written into the CSS, default `../fonts/` |
| font-display | `swap`, `optional`, `fallback`, `block`, `auto` |
| Extras | Fallback face, demo page, typography tokens |

The full list with API names is in [Kit options](/docs/kit-options).

## The demo page

Open `demo.html` from the kit folder in any browser. It has:

- **Use it:** the link tag and font-family line.
- **Playground:** choose a face, move the size and axis sliders, type your own text, and copy the CSS for exactly what you see.
- **Every combination:** each combination of the kit's variants (weights × widths × optical sizes and so on) with a live sample and its CSS.
- **Named instances** that fall within the axes you kept.

## Via the API

```bash
curl -X POST "https://fonts.example.com/api/v1/families/$FAMILY_ID/kit" \
  -H "Authorization: Bearer $TYPEFACE_KEY" -H "Content-Type: application/json" \
  -d '{"formats":["woff2","woff"],"characters":"latin-ext","axes":{"wght":{"min":300,"max":700}}}' \
  -o kit.zip
```

The same options on the same version return a cached ZIP instantly.
