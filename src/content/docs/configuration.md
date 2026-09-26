---
title: Configuration
description: Environment variables and what they control.
---

# Configuration

Typeface Hub is configured with environment variables. Locally, put them in `.env` (see `.env.example`).

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string. `POSTGRES_URL` also works. On Vercel, set by the Neon integration. |
| `AUTH_SECRET` | Yes in production | Signs session cookies. Use 32+ random characters: `openssl rand -base64 32`. In Docker, leave it empty and one is generated on first start and kept in the data volume. |
| `BLOB_READ_WRITE_TOKEN` | No | Vercel Blob token. When set, files are stored in Blob and large uploads go straight from the browser to Blob. When unset, files go to `./.data/storage`. |
| `BLOB_PRIVATE_READ_WRITE_TOKEN` | Recommended on Vercel | Token of a second Blob store created with **private** access. Original font files and cached kits go there, so they can't be downloaded by URL. Without it they live in the public store at unguessable URLs. |
| `RESEND_API_KEY`, `EMAIL_FROM` | No | Send password-reset emails with [Resend](https://resend.com). `EMAIL_FROM` is the sender, e.g. `Typeface Hub <fonts@example.com>`. Without them, reset links are written to the server log. |
| `INSECURE_COOKIES` | No | Set to `true` only if you serve the app over plain HTTP on a non-localhost address (for example a LAN IP), so the session cookie works without HTTPS. |
| `GOOGLE_FONTS_API_KEY` | No | Use the live Google Fonts Developer API. Without it, the bundled catalogue is used. |
| `NEXT_PUBLIC_APP_URL` | No | Public base URL used in generated CSS and SDUI links, for example a custom font domain. Defaults to the request host. |

## Docker Compose

`docker-compose.yml` sets `DATABASE_URL` for you, and a random `AUTH_SECRET` is generated on first start. Override settings in a `.env` next to it:

```bash
AUTH_SECRET=…                   # optional
RESEND_API_KEY=…                # optional, for reset emails
EMAIL_FROM=Typeface Hub <fonts@example.com>
GOOGLE_FONTS_API_KEY=…
APP_URL=http://localhost:3000   # becomes NEXT_PUBLIC_APP_URL
```

## Database migrations

Migrations live in `./drizzle` and run automatically:

- on Vercel, before every build (`npm run build`)
- in Docker, when the container starts

To create one after changing `src/lib/db/schema.ts`:

```bash
npm run db:generate
npm run db:migrate
```

## Google Fonts catalogue

The bundled catalogue (`src/data/google-fonts.json`) and the unicode ranges for subsets (`src/data/subsets.json`) are generated from the `google-font-metadata` package. Refresh them with:

```bash
npm run catalog:build
```
