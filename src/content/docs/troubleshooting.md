---
title: Troubleshooting
description: Common problems and how to fix them.
---

# Troubleshooting

## Fonts don't show on my site

1. **Is the family published?** The CSS API only serves published versions. Check for a *Live: v1* badge on the family.
2. **Open the CSS link directly.** A comment at the top such as `/* Not served: Lato: no normal 900 face */` tells you which weights or families are missing.
3. **Check the family name in your CSS** matches the family's **CSS family name** (Settings tab), including spaces and capitals.
4. **Check CSP.** Your `font-src` and `style-src` must allow the Typeface Hub domain. See [Using fonts](/docs/using-fonts#content-security-policy).
5. **Changes not showing?** Stylesheets are cached for up to about 5 minutes after a publish. Hard-reload to bypass your browser cache.

## A weight looks wrong or bold is faked

Browsers synthesise bold or italic when the requested face doesn't exist. Request the weights you use (`wght@400;700`), and check the face weights on the review screen. Older fonts sometimes have wrong weight classes: correct them in the draft before publishing.

## Upload problems

| Message | Fix |
| --- | --- |
| *This file is not a font* | Upload TTF, OTF, WOFF or WOFF2. EOT and SVG fonts aren't needed. |
| *Font collections (.ttc) are not supported* | Export each face as its own TTF or OTF. |
| *The font file is corrupt* | Re-export it from the source, or download it again. |
| *Same face as …* | The same face was uploaded in several formats; the best one is used. |
| *This exact file is already in …* | The file is identical to one in the library. Uploading it creates a new version. |
| *Confirm that you are licensed…* | Tick the licence confirmation. |

## A job failed

Open **Jobs**. Each failed job shows the step it stopped at and the reason. Fix the cause (for example a corrupt file) and click **Retry**, or upload again.

## Sign-in fails in production

Set `AUTH_SECRET` in your environment variables and redeploy.

## Docker

- **`failed to connect to the docker API`**: open Docker Desktop and wait until it's running.
- **`address already in use`**: another process uses port 3000 or 5432. Stop it, or change the port mapping in `docker-compose.yml`.
- **Start from scratch:** `docker compose down -v` deletes the database and files.

## Converter

- **Too many conversions:** the limit is 30 per hour per network. Wait for the time shown, or create a workspace.
- **No preview:** some fonts can't be loaded by the browser for preview. Conversion still works.
