---
title: FAQ
description: Short answers to common questions.
---

# FAQ

## Do I still need EOT and SVG fonts?

No. EOT was only for Internet Explorer and SVG fonts for very old iOS. WOFF2 covers every current browser, and WOFF covers the rest.

## Which file should I upload: TTF, OTF or WOFF2?

TTF or OTF if you have them, since they are the original masters. WOFF2 also works. Uploading one format per weight is enough.

## Should I use a variable font?

If you use three or more weights of a family, a variable font is usually smaller in total and gives you every weight in between. Cap its weight range to what you use to make it smaller still.

## Why does my page load several files for one weight?

Each weight is split by script. The browser downloads a file only if the page contains characters from that script, so most pages load just the Latin file.

## What is the "Fallback" font in my font stack?

A local system font resized to match your web font's proportions, so text doesn't jump when the web font finishes loading.

## How fast do changes go live?

Publishing or rolling back updates the CSS API immediately. Sites pick it up within about 5 minutes as the CDN refreshes. Font files never change; new versions get new file names.

## Can I use Google Fonts without sending requests to Google?

Yes. Choose **Import as internal**, or turn on **Self-host only** in workspace settings to block external delivery.

## Is the free converter really free, and are my fonts kept?

Yes, within the rate limits. Files are processed in memory and deleted after conversion.

## Can I self-host Typeface Hub?

Yes. Run it with Docker or deploy it to Vercel. See [Run locally](/docs/run-locally) and [Deploy to Vercel](/docs/deploy-vercel).
