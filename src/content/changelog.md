---
title: Changelog
description: What's new in Typeface Hub.
---

# Changelog

## September 2026

### Documentation, new logo and site pages

- A full documentation site: getting started, guides, API reference and troubleshooting.
- New logo: three bars of increasing weight forming a T.
- New About, Privacy, Terms and Changelog pages, and a shared site header and footer.

### Kit demo pages

- A playground with a slider for every axis and the CSS to copy.
- Every combination of the kit's variants, and its named instances, each with a live sample and CSS.

### Variable font controls and live preview

- Dropped files are marked **Variable** or **Static**, with their axes and named instances.
- For every axis (weight, width, optical size, slant, custom): keep the full range, limit it, or pin a value.
- Static exports use your pinned values and get correct names, such as *Condensed Bold*.
- Live preview in the converter, with sliders that stop at your limits.

### Free converter

- Convert fonts into a web font kit at [/convert](/convert) without an account. Files aren't kept.

### Download kits

- Download any family as WOFF2, WOFF and TTF/OTF files with CSS, a demo page and a README, from the app or the API.

### Docker

- Run the app and Postgres locally with `docker compose up --build`.

### First release

- Font library with uploads, ZIPs, Google Fonts and stylesheet or legacy CSS import.
- Processing pipeline: validation, metadata, WOFF2 + WOFF, unicode-range subsets, content-hashed files, fallback metrics.
- Versions with draft, review, publish and rollback; licence records; roles; audit log.
- Google-style CSS API, typography tokens, SDUI endpoint, REST API with scoped keys, and monitoring.
