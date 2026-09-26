---
title: Adding fonts
description: Upload files, import from Google Fonts, or add fonts from a stylesheet.
---

# Adding fonts

Every family enters through **Add font** and ends on the same review screen before it can be published.

## Upload files

Drop files onto the upload area or click **Choose files**.

- **Formats:** TTF, OTF, WOFF, WOFF2, and ZIP files containing them.
- **Size:** up to 20 MB per file and 60 files at a time.
- **What to upload:** one source file per weight and style, or a single variable font. TTF or OTF is best; WOFF2 also works. You do not need EOT, SVG or CSS files.

After upload, each file is read and listed with its family, style, weight, glyph count, scripts and any warnings.

### How files are grouped

Files are grouped into families by their typographic family name (name ID 16, falling back to name ID 1). To move a file to another family, edit its **Family** field; existing names are suggested as you type.

If the same face appears in several formats, for example `Bold.ttf` and `Bold.woff2` from an old export, only the best source is used (TTF/OTF first, then WOFF2, then WOFF) and the others are marked as skipped.

If a file is byte-for-byte identical to one already in the library, you are warned. Uploading it again creates a new version.

### Adding a new version

Upload files whose family name matches an existing family and they become the next version of that family, as a draft. See [Review, publish and roll back](/docs/review-and-publish).

### ZIP files

ZIPs are unpacked on upload. Only TTF, OTF, WOFF and WOFF2 files inside are used; everything else (CSS, EOT, SVG, `__MACOSX`) is ignored and noted.

## Google Fonts

The **Google Fonts** tab searches about 1,900 families. Filter by category or show variable fonts only. Pick a family to see a live preview, then choose how it is delivered:

| Option | What happens | When to use it |
| --- | --- | --- |
| **Load external** | Pages load the font from Google's CDN. Typeface Hub records the family and faces for tokens and pickers. | Quick setup; you are fine with a third-party request. |
| **Import as internal** | The original files are downloaded once from the google/fonts repository, processed like an upload, and served from your own CSS API. | Privacy (no Google requests), consistent caching, or axis limiting. |

For imports you can cap the weight range of variable families to reduce file size.

A workspace default is set in **Settings**. If the workspace is **self-host only**, Load external is disabled.

## Stylesheet URL

The **Stylesheet & legacy import** tab reads `@font-face` rules from any CSS URL, such as Adobe Fonts or another CDN. After **Read stylesheet**, choose families and a delivery option:

- **Import as internal**: downloads the best source per face (TTF/OTF, then WOFF2, then WOFF) and processes it.
- **Load external**: the CSS API imports the provider's stylesheet as is.

## Pasting existing CSS

Paste stored CSS (for example from FanXP or a Transfonter export) and, if its URLs are relative, the base URL the files are served from. EOT and SVG sources are ignored. See [Migrating existing fonts](/docs/migrating).

## Licence confirmation

Every path that self-hosts a font asks you to confirm you are licensed to do so. See [Licensing](/docs/licensing).
