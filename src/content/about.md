---
title: About
description: Why Typeface Hub exists and how it is built.
---

# About Typeface Hub

Typeface Hub started with a simple frustration: adding a font to a website took fifteen minutes of manual work, and still shipped more than the page needed.

The usual routine was to convert files on a third-party site, upload five formats for every weight, then upload a hand-made CSS file that became the only record of what the font even was. Variable fonts and Google Fonts didn't fit. Every page loaded every weight. One wrong CSS file quietly broke the typography, and nobody could say which fonts were licensed for which sites.

Every team building sites was repeating the same work. So we built one place to do it properly.

## What we believe

- **Add a font once.** Every site, app and editor that needs it should get it from the same place, in the same way.
- **Ship only what renders.** A page should download the faces and characters it shows, and nothing else.
- **Typography is a system, not a folder of files.** Roles, scales and tokens belong next to the fonts they use.
- **Changes should be safe.** Every change gets a draft, a review and a one-click way back.
- **Respect the type designers.** Licences are recorded, checked and passed on with every kit.

## How it works

Typeface Hub validates each font, reads its metadata and variable axes, converts it to WOFF2 and WOFF, splits it by script, and gives every file a content-hashed name so it can be cached for a year. A Google-style CSS API serves exactly the faces a page asks for, with metric-matched fallback fonts so text doesn't jump when the web font arrives.

It is built with Next.js, Postgres and HarfBuzz, the same text engine used by major browsers and operating systems, and it runs on Vercel or anywhere Docker runs.

## Get in touch

Found a bug or have an idea? Open an issue on [GitHub](https://github.com/developerr-ayush/Typeface-Hub). To try it, use the [free converter](/convert) or [create a workspace](/signup).
