---
title: Changelog
description: What's new in Typeface Hub.
---

# Changelog

## September 2026

### Ready for launch

- Security fixes:
  - Stylesheet imports can no longer be redirected to internal addresses.
  - Upload references are strictly checked.
  - Password-reset links only use the configured site address.
  - Delivery API keys only reach the SDUI endpoint and tokens.
  - Family names are escaped in all generated CSS.
- A sitemap, robots.txt, social preview tags and stricter security headers (HSTS, frame protection).
- `GET /api/health` for uptime monitors.
- New 404 and error pages, and a loading state in workspaces.
- Privacy and Terms show who runs the service (`OPERATOR_NAME`, `CONTACT_EMAIL`), with a **Contact** link in the footer.
- A launch checklist in the [Vercel deployment guide](/docs/deploy-vercel#launch-checklist).

### Icon fonts

- A new icon font generator at [/icons](/icons), free and without an account: pick from more than 11,000 icons in 16 open-source sets (Font Awesome, Material Design Icons, Bootstrap Icons, Entypo, Typicons and more) or upload your own SVGs.
- Downloads include WOFF2, WOFF and TTF files, a stylesheet with one class per icon, an embedded variant, a searchable demo page, a licence list and a `config.json`.
- Opens Fontello `config.json` files and ZIPs, and exports configs that open in Fontello.
- SVG uploads handle shapes, groups and transforms, and convert even-odd holes automatically; outline-only (stroke) icons are flagged.
- Workspaces get **Icon fonts**: save, publish to a stylesheet link and manage them with the REST API.

### Security and reliability

- Sign-in, sign-up and password reset are rate limited per network and per account, with a global safety limit.
- **Forgot your password?** sends a one-time reset link (by email with Resend, or to the server log). Resetting or changing a password signs out other devices.
- New **Account** page to change your name and password.
- Original font files and cached kits can be kept in a private Vercel Blob store (`BLOB_PRIVATE_READ_WRITE_TOKEN`).
- Docker generates a random session secret on first start; weak or example secrets are refused in production.
- Jobs interrupted by a restart or deploy resume automatically; after three failures they're marked failed with a clear reason.
- CSS API statistics only count families that exist.
- Browser tests (Playwright) now run in CI against a real database.

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
