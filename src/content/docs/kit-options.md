---
title: Kit options
description: Every option for download kits and the converter API.
---

# Kit options

These options apply to `POST /api/v1/families/{id}/kit` and to the `options` of `POST /api/convert`.

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `versionId` | uuid | Live version, else the latest | Kits only |
| `faceIds` | uuid[] | All faces | Kits only |
| `formats` | `woff2` \| `woff` \| `sfnt` | `["woff2","woff"]` | `sfnt` is TTF, or OTF for CFF fonts |
| `characters` | `latin-ext` \| `latin` \| `split` \| `full` \| `custom` | `latin-ext` | `split` makes one file per script with `unicode-range` |
| `customText` | string | | Required when `characters` is `custom` |
| `variable` | `variable` \| `static` | `variable` | `static` cuts separate files per weight |
| `staticWeights` | number[] | `[400, 700]` | Weights outside a face's range are skipped |
| `axes` | object | none | Per axis: `{ "min": 300, "max": 700 }` keeps a range, a number pins it |
| `pathPrefix` | string | `../fonts/` | Path to the fonts, as written in the CSS |
| `display` | `swap` \| `optional` \| `fallback` \| `block` \| `auto` | `swap` | |
| `fallback` | boolean | `true` | Include the metric-matched fallback face |
| `unicodeRange` | boolean | `true` | Write `unicode-range` into the CSS |
| `demo` | boolean | `true` | Include `demo.html` |
| `tokens` | boolean | `false` | Include `tokens.css` (kits only) |

## Axis examples

```json
{ "axes": { "wght": { "min": 300, "max": 700 } } }
```

Keeps weights 300 to 700, still one variable file.

```json
{ "axes": { "wght": { "min": 300, "max": 700 }, "wdth": 100, "opsz": 14 } }
```

Also removes the width and optical size axes, fixed at 100 and 14.

```json
{ "variable": "static", "staticWeights": [400, 700], "axes": { "wdth": 75 } }
```

Two static files, both condensed (width 75), named *Condensed Regular* and *Condensed Bold*.

Values outside a font's range are clamped to it. Axes a font doesn't have are ignored.

## Output

```text
{family}-webfont-kit/
├── fonts/{family}-{weight|variable}[-w{width}][-italic][-{subset}].{woff2|woff|ttf|otf}
├── css/{family}.css
├── css/tokens.css      (tokens: true)
├── demo.html           (demo: true)
└── README.txt
```

The converter response also has an `X-Convert-Summary` header: base64url JSON listing the families, faces and skipped files.
