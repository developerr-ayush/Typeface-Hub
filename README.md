# Typeface Hub

A font management and delivery platform. Add a font once, from any source, and every site, app and editor that uses it gets optimised files, generated CSS and only the weights each page needs.

**Upload or pick a font → the platform validates, converts, subsets and catalogues it → a Google-style CSS API delivers exactly what each page renders.**

Built with Next.js 16 (App Router), Postgres (Drizzle ORM), Vercel Blob, HarfBuzz (`subset-font`) and `fontkit`.

## What it does

| Area | Highlights |
| --- | --- |
| **Sources** | Drag-and-drop TTF / OTF / WOFF / WOFF2 / ZIP (Transfonter exports are unpacked; CSS, EOT and SVG are ignored). Google Fonts browser with search, category and variable filters, and **Load external** or **Import as internal**. Stylesheet URLs (Adobe Fonts, CDNs) and pasted legacy CSS. |
| **Pipeline** | Magic-byte validation, metadata extraction (name IDs 16/1, weight class, style, width, glyphs, scripts, licence fields), variable-font detection (`fvar` axes, named instances), conversion to **WOFF2 + WOFF**, **unicode-range subsets** (latin, latin-ext, vietnamese, cyrillic, greek, devanagari and more), content-hashed file names, metric-matched fallback faces, and a processing report with before/after sizes. Runs as a job with visible status and one-click retry. |
| **Variable fonts** | Axis ranges and named instances detected automatically, range-based `@font-face` (`font-weight: 100 900`), weight sliders that snap to named instances, and axis **limiting / pinning** to cut bytes. |
| **Delivery** | `GET /fonts/{workspace}/css?family=Montserrat:ital,wght@0,400;1,700&display=swap`: Google CSS2 syntax, one `@font-face` per face per subset, WOFF2 first, `'Name Fallback'` faces with `size-adjust` / `ascent-override` to reduce layout shift, immutable one-year caching for files, CORS on everything. |
| **Typography** | Font roles (heading, body, display, mono, custom), text styles H1–H6 / body / caption / button / label, responsive sizes per breakpoint or fluid `clamp()`, type-scale generator, themes, accessibility checks. Output as CSS custom properties, JSON and an **SDUI contract** (`fonts.css[]`, `fonts.preload[]`, `fonts.preconnect[]`, `typography.tokens`). |
| **Governance** | Every upload of an existing family becomes a new **draft version**; review screen with editable faces, side-by-side compare, publish, one-click **rollback**, licence records and confirmation, archive with in-use protection, roles (Viewer, Editor, Publisher, Admin), multi-tenant workspaces and a full **audit log**. |
| **Download kit** | On any family, download a ZIP with the fonts in WOFF2, WOFF and TTF/OTF, a ready-made stylesheet, a metric-matched fallback, optional typography tokens, a `demo.html` (a playground with a slider per axis, every combination of the kit's variants and its named instances, each with the CSS to copy) and a README. Options cover faces, character sets (Latin, Latin + Extended, split by script, full, or custom characters), static weights cut from variable fonts, the font path and `font-display`. Also available as `POST /api/v1/families/{id}/kit`. |
| **Free converter** | A public page at `/convert`, no account needed: upload TTF / OTF / WOFF / WOFF2 or a ZIP, see right away which files are variable or static and which axes they have, try the font live with sliders, limit or pin any axis (weight, width, optical size, slant, custom), pick formats and characters, and download the same kind of kit. Nothing is stored; uploads are deleted after conversion. Rate limited to 30 conversions per hour per network, 12 files of up to 15 MB each. |
| **Developers** | REST API under `/api/v1` with workspace **API keys** (delivery / read / write / publish scopes), CSS API, token stylesheet, SDUI endpoint. See the **Developers** page in the app. |
| **Monitoring** | CSS API latency (p50/p95 histogram), error rate and most-requested families; pipeline success rate, durations and failure reasons. |

## Deploy to Vercel

1. **Import the repo** in Vercel (*Add New → Project*). The framework is detected as Next.js; keep the defaults.
2. **Add a Postgres database.** In the project, open *Storage → Create Database → Neon (Postgres)* and connect it to the project. This sets `DATABASE_URL`.
3. **Add Blob storage.** *Storage → Create → Blob*, choose **public** access, and connect it to the project. This sets `BLOB_READ_WRITE_TOKEN`.
4. **Set `AUTH_SECRET`** under *Settings → Environment Variables* to a long random string (for example the output of `openssl rand -base64 32`).
5. **Deploy.** The build runs `scripts/migrate.mjs` first, so the database schema is created and kept up to date on every deploy.
6. Open the site, **create an account**, and you get your first workspace.

Optional environment variables:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_FONTS_API_KEY` | Use the live Google Fonts Developer API. Without it, the bundled catalogue (`src/data/google-fonts.json`, ~1,900 families) is used. Refresh it with `npm run catalog:build`. |
| `NEXT_PUBLIC_APP_URL` | Public base URL for absolute links in generated CSS and SDUI (for example a custom font domain). Defaults to the request host. |

Font processing runs in the background after the request (`after()`), with `maxDuration` of 300 s on processing routes. Large uploads go straight from the browser to Vercel Blob, so the 4.5 MB request limit doesn't apply.

## Run locally with Docker

The easiest way. Needs only [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up --build
```

Open http://localhost:3000 and create an account. The first build takes a few minutes; after that `docker compose up` starts in seconds.

- Postgres runs in its own container, and migrations run automatically when the app starts.
- Data is kept in Docker volumes, so it survives restarts: `db-data` for the database and `font-files` for uploaded and generated font files.
- `docker compose down` stops everything. `docker compose down -v` also **deletes** the database and font files.
- After changing the code, run `docker compose up --build` again.
- Optional: set `AUTH_SECRET` or `GOOGLE_FONTS_API_KEY` in a `.env` file next to `docker-compose.yml`, or change the public URL with `APP_URL=http://localhost:3000`.
- The database is also exposed on `localhost:5432` (user and password `typeface`), so you can run just the database with `docker compose up db` and the app with `npm run dev` using `DATABASE_URL=postgres://typeface:typeface@localhost:5432/typeface_hub`.

## Run locally without Docker

Requirements: Node 20.9+ and a Postgres database.

```bash
npm install
cp .env.example .env        # set DATABASE_URL and AUTH_SECRET
npm run db:migrate          # create the schema
npm run dev                 # http://localhost:3000
```

Without `BLOB_READ_WRITE_TOKEN`, files are stored in `./.data/storage`.

Other scripts:

```bash
npm test                    # unit tests (Vitest)
npm run lint                # TypeScript type-check
npm run build               # migrate + production build
npm run db:generate         # new SQL migration after editing src/lib/db/schema.ts
npm run catalog:build       # refresh the bundled Google Fonts catalogue and subset ranges
```

## Using the fonts on a site

```html
<link rel="preload" href="https://your-app.vercel.app/fonts/files/montserrat-vf-latin.a8f3c1d2e4.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="https://your-app.vercel.app/fonts/acme/css?family=Montserrat:wght@400;700&family=Bakbak+One&display=swap">
<link rel="stylesheet" href="https://your-app.vercel.app/fonts/acme/tokens.css?theme=default">

<h1 class="text-h1">Uses the heading role</h1>
<p style="font-family: var(--font-body)">Body copy</p>
```

For server-rendered apps, call `GET /api/v1/sdui?theme=default&styles=h1,body` with a delivery API key and render the returned `css`, `preload` and `preconnect` links in the document head.

## Download a kit instead of using the CSS API

Open a family, click **Download kit** (or go to its **Use** tab), pick the options and click **Download ZIP**. Copy `fonts/` and `css/` into your project and add `<link rel="stylesheet" href="/css/<family>.css">`.

With the API:

```bash
curl -X POST https://your-app.vercel.app/api/v1/families/<family-id>/kit \
  -H "Authorization: Bearer $TYPEFACE_KEY" -H "Content-Type: application/json" \
  -d '{"formats":["woff2","woff","sfnt"],"characters":"latin-ext","variable":"static","staticWeights":[400,700]}' \
  -o kit.zip
```

| Option | Values | Default |
| --- | --- | --- |
| `versionId` | any version of the family | the live version (or the latest draft) |
| `formats` | `woff2`, `woff`, `sfnt` (TTF, or OTF for CFF fonts) | `["woff2","woff"]` |
| `faceIds` | face ids to include | all faces |
| `characters` | `latin`, `latin-ext`, `split`, `full`, `custom` (with `customText`) | `latin-ext` |
| `variable` | `variable`, or `static` with `staticWeights` | `variable` |
| `axes` | per axis: `{"min":300,"max":700}` to keep a range, or a number to pin it, e.g. `{"wght":{"min":300,"max":700},"wdth":100,"opsz":14}`. In static mode, pinned values are used for every static file. | none (keep every axis) |
| `pathPrefix` | font path used in the CSS | `../fonts/` |
| `display` | `swap`, `optional`, `fallback`, `block`, `auto` | `swap` |
| `fallback`, `demo`, `tokens` | include the fallback face, `demo.html`, `tokens.css` | `true`, `true`, `false` |

The same options on the same version return a cached ZIP instantly.

## Project layout

```
src/app/                  pages (App Router) and route handlers
  api/v1/                 management REST API
  fonts/[ws]/css          public CSS API
  fonts/[ws]/tokens.css   public token stylesheet
  fonts/files/[name]      immutable font files
  w/[ws]/                 workspace UI: library, add font, family, typography, jobs, developers, monitoring, activity, settings
src/lib/
  fonts/                  metadata, unicode subsets, conversion (HarfBuzz)
  css-api.ts              CSS2 query parsing, face selection, @font-face generation
  jobs.ts                 processing pipeline (upload, Google import, CSS import, axis limits)
  families.ts             library, versions, publish, rollback, archive
  tokens.ts, typography.ts typography tokens, CSS/JSON output, SDUI
  db/schema.ts            Drizzle schema (migrations in ./drizzle)
tests/                    unit tests
```

## Not built yet

These PRD items are outside the current build: an OpenType Sanitiser (OTS) pass and virus scanning (files are re-encoded by HarfBuzz, which rebuilds every table, but that is not a full OTS check); webhooks; the JS/React SDK and CLI; CDN purge on publish (stylesheets use a short CDN cache with stale-while-revalidate instead, so a publish is live within about 5 minutes); domain enforcement and licence expiry alerts; approval flow; shared libraries across workspaces; real-content widget previews and glyph-coverage checks against page content; real-user monitoring; per-locale subset loading; static fallback instances; `text=` subsets; Figma sync; pairing suggestions.
