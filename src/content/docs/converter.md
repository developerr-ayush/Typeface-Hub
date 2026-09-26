---
title: Free converter
description: Convert fonts into a web font kit without an account.
---

# Free converter

The [converter](/convert) builds the same kind of kit as the library, for anyone, without an account. Nothing is added to a library, and uploaded files are deleted as soon as the kit is ready.

## Steps

1. **Drop fonts:** TTF, OTF, WOFF, WOFF2, or a ZIP of them. Each file is read straight away and marked **Variable** or **Static**, with its family, style, format and axes.
2. **Preview:** the font loads straight into the page (it is not uploaded for this). Type your own text and use the size and axis sliders. The sliders stop where your axis settings cut the font, so you see exactly what the download can do.
3. **Choose options:** formats, characters, and for variable fonts, keep variable or export static weights, plus per-axis limits and pins. CSS options (path, `font-display`, fallback, demo page) are under **CSS options**.
4. **Confirm the licence** and click **Convert & download**.

If you drop several families, the ZIP has one folder per family.

## Limits

| Limit | Value |
| --- | --- |
| Files per conversion | 12 |
| Size per file | 15 MB |
| Total per conversion | 40 MB |
| Conversions | 30 per hour per network |

## Privacy

- Files are processed in memory.
- When hosted on Vercel, uploads go to temporary storage and are deleted right after conversion; anything left behind is cleared within an hour.
- IP addresses are only used for rate limiting, and are hashed before they are stored.

## When to use the library instead

The converter gives you files. The library adds versioning, review and rollback, typography tokens, and a CSS API that serves only the weights and scripts each page renders. If you manage fonts for more than one site, [create a workspace](/signup).
