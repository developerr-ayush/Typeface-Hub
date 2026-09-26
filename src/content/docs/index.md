---
title: Introduction
description: What Typeface Hub is, how it fits together, and where to start.
---

# Introduction

Typeface Hub is a font management and delivery platform. You add a font once, from any source, and every site, app and editor that uses it gets optimised files, generated CSS and only the weights each page needs.

**In one line:** upload or pick a font → Typeface Hub validates, converts, subsets and catalogues it → a Google-style CSS API delivers exactly what each page renders.

## What it replaces

Adding a font the old way usually means converting files on a third-party site, uploading five formats per weight, and hand-writing or uploading a CSS file that becomes the only record of what the font is. Typeface Hub removes each of those steps:

| Before | With Typeface Hub |
| --- | --- |
| Convert files on transfonter.org | Upload the TTF or OTF; conversion is automatic |
| Upload TTF, WOFF, WOFF2, EOT and SVG for every weight | One source file per weight (or one variable font) |
| A hand-made CSS file is the only source of truth | Faces, weights, axes and licences are catalogued and editable |
| Every page loads every weight | Each page requests only the faces and scripts it renders |
| No variable fonts or Google Fonts support | Both are first-class |

## How it fits together

- **Library.** Every family in a workspace, from four sources: uploaded files (including ZIPs), Google Fonts, stylesheet URLs, and pasted legacy CSS.
- **Processing pipeline.** Each file is validated, its metadata and variable axes read, converted to WOFF2 and WOFF, split by script with `unicode-range`, and stored with content-hashed names. A report shows what changed.
- **Versions.** Every upload of an existing family is a new draft. Drafts are reviewed and published; any earlier version can be restored in one click.
- **Delivery.** A public CSS API with Google Fonts' CSS2 syntax, immutable font files, metric-matched fallback fonts, and a token stylesheet.
- **Typography tokens.** Font roles (heading, body, …) and text styles with responsive sizes, exported as CSS variables, JSON and an SDUI contract.
- **Kits and converter.** Download any family as a ZIP of files plus CSS, or use the free converter without an account.

## Where to start

- **Trying it out?** Follow the [Quick start](/docs/quick-start).
- **Running it yourself?** See [Run locally](/docs/run-locally) or [Deploy to Vercel](/docs/deploy-vercel).
- **Wiring it into a site?** Read [Using fonts on your site](/docs/using-fonts) and the [CSS API reference](/docs/css-api).
- **Just need web font files?** Use the [free converter](/convert).
