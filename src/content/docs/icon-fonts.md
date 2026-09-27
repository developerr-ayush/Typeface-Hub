---
title: Icon fonts
description: Build icon fonts from open-source icon sets or your own SVGs, open Fontello configs, and serve them from a workspace.
---

# Icon fonts

The icon font generator turns the icons you pick into a small web font with one CSS class per icon, like [Fontello](https://fontello.com). It works in two places:

- **[/icons](/icons)**: free, no account. Your selection is kept in your browser and you download a ZIP.
- **Icon fonts** in a workspace: saved with the workspace, published to a stylesheet link, and editable by your team.

## Picking icons

Search more than 11,000 icons from these bundled sets, or filter by one set:

| Set | Icons | Licence |
| --- | --- | --- |
| Font Awesome 4.7, Entypo, Typicons, Iconic, Modern Pictograms, Meteocons, MFG Labs, Brandico, Elusive, Web Symbols, Fontelico | about 2,100 | SIL OFL |
| Maki | 63 | BSD |
| Zocial | 103 | MIT |
| Linecons | 48 | CC BY 3.0 (attribution required) |
| Material Design Icons | about 7,200 | Apache 2.0 |
| Bootstrap Icons | about 2,000 | MIT |

Click an icon to add it and click it again to remove it. The first 14 sets are the ones built into Fontello, so any Fontello config opens here.

## Uploading your own SVGs

Open **Upload SVG** and drop one or more `.svg` files. Each file becomes one icon, named after the file (`My Logo.svg` becomes `my-logo`).

- The icon is scaled so its `viewBox` fills the font's height. Draw icons on the same square canvas (for example 24 × 24) so they line up.
- Paths, rectangles, circles, ellipses, polygons, groups and transforms are supported. Even-odd holes (`fill-rule="evenodd"`) are converted automatically.
- **Strokes are skipped.** Fonts can only hold filled shapes, so convert strokes to outlines first: in Figma, *Outline stroke*; in Illustrator, *Object → Path → Outline Stroke*; in Inkscape, *Path → Stroke to Path*.
- Colours, gradients, images, text and `<use>` references are ignored. An icon font is one colour: the text colour.

SVGs are converted in your browser, so they aren't uploaded until you build the font.

## Names and codes

Every icon gets a **class name** and a **code point**. New icons start at U+E800 in the Unicode Private Use Area, the same as Fontello, so they never clash with real characters. You can change either in the list under **Your font**; duplicates are flagged before you download.

| Setting | Default | Result |
| --- | --- | --- |
| Font name | `icons` | `font-family: 'icons'`, files named `icons.woff2` and so on |
| Class prefix | `icon-` | `<i class="icon-home">` |
| Use a suffix | off | With the suffix `-icon`: `<i class="home-icon">` |

## What's in the ZIP

```text
icons-icons/
├── font/
│   ├── icons.woff2
│   ├── icons.woff
│   └── icons.ttf
├── css/
│   ├── icons.css            @font-face, the shared icon rule and one class per icon
│   ├── icons-codes.css      only the per-icon classes
│   └── icons-embedded.css   the stylesheet with the WOFF2 embedded (no font files needed)
├── demo.html                every icon with its class and code; click to copy
├── config.json              open it again here (or in Fontello) to change the font
├── LICENSE.txt              the licences of the sets you used
└── README.md
```

Copy `font/` and `css/` into your site and link the stylesheet:

```html
<link rel="stylesheet" href="/css/icons.css">

<i class="icon-home" aria-hidden="true"></i>
<button aria-label="Search"><i class="icon-search" aria-hidden="true"></i></button>
```

Icons take the text colour and size, so style them like text: `.icon-home { color: #0f766e; font-size: 24px; }`. In React or Next.js, import the stylesheet once (for example in the root layout) and write `<i className="icon-home" aria-hidden="true" />`.

## Opening a Fontello config

Click **Open config.json or ZIP** and choose a `config.json`, or the whole ZIP downloaded from Fontello or Typeface Hub. Icons from Fontello's sets are matched by their `uid`, and custom icons keep their outlines, names and codes. Icons that can't be matched are listed so you can upload them again.

The `config.json` in every kit uses Fontello's format: icons from Fontello's sets are listed by `uid`, and all others are embedded as custom icons. It opens in Fontello too.

## Icon fonts in a workspace

Open **Icon fonts** in the sidebar and click **New icon font**. The editor is the same, with three more actions:

- **Save** keeps the font with the workspace (Editors and above).
- **Publish** builds it and serves it from a stylesheet link (Publishers and above):

  ```html
  <link rel="stylesheet" href="https://your-app.vercel.app/fonts/acme-studio/icons/icons.css">
  ```

  Font files have content-hashed names and are cached for a year; the stylesheet is cached for about 5 minutes, so a new publish is live within minutes. Changes you save afterwards don't affect the live stylesheet until you publish again.
- **Download ZIP** gives the same kit as the public generator.

With the REST API (see [REST API](/docs/rest-api#icon-fonts)):

```bash
curl https://your-app.vercel.app/api/v1/icon-fonts -H "Authorization: Bearer $TYPEFACE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"app","glyphs":[{"uid":"mdi-home","css":"home","code":59392,"src":"mdi"}]}'
```

## Icon fonts or SVG?

Icon fonts are one small cached file, work with plain CSS classes and inherit the text colour. Choose inline SVG or an SVG sprite for multi-colour icons, or when every icon must be pixel-perfect at small sizes (fonts are anti-aliased like text).
