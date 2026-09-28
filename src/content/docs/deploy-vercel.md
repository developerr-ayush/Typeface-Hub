---
title: Deploy to Vercel
description: Host Typeface Hub on Vercel with Neon Postgres and Vercel Blob.
---

# Deploy to Vercel

Typeface Hub is a Next.js app and deploys to Vercel without changes.

## 1. Import the repository

In Vercel, choose **Add New → Project** and import the repository. Vercel detects Next.js; keep the default build settings.

## 2. Add a database

In the project, open **Storage → Create Database** and choose **Neon (Postgres)**. Connect it to the project. This sets `DATABASE_URL` for every environment.

## 3. Add file storage

Open **Storage → Create → Blob**, choose **public** access, and connect it to the project. This sets `BLOB_READ_WRITE_TOKEN`. Uploads then go straight from the browser to Blob, so Vercel's 4.5 MB request limit does not apply.

### Keep original font files private (recommended)

Create a **second** Blob store with **private** access. When connecting it to the project, set the environment variable prefix to `BLOB_PRIVATE` so its token is added as `BLOB_PRIVATE_READ_WRITE_TOKEN` and doesn't replace the first store's token. Original uploads and cached kits are stored there and can't be downloaded by URL. The public store keeps serving the optimised delivery files.

## 4. Set the session secret

Under **Settings → Environment Variables**, add `AUTH_SECRET` with a long random value:

```bash
openssl rand -base64 32
```

> **Important** Without `AUTH_SECRET`, sign-in fails in production.

## Optional: email for password resets

Create a [Resend](https://resend.com) account, verify your sending domain, and add `RESEND_API_KEY` and `EMAIL_FROM` (for example `Typeface Hub <fonts@example.com>`). Without them, reset links only appear in the function logs.

## 5. Deploy

Deploy the project. The build runs database migrations before `next build`, so the schema is created on the first deploy and updated on every later one.

Open the site and create an account.

## Launch checklist

Before you share the link:

- [ ] `AUTH_SECRET` is set to a long random value.
- [ ] A private Blob store is connected (`BLOB_PRIVATE_READ_WRITE_TOKEN`); **Settings** in the app shows no storage warning.
- [ ] `NEXT_PUBLIC_APP_URL` is your final domain, and the domain is added under **Settings → Domains**.
- [ ] `RESEND_API_KEY` and `EMAIL_FROM` are set, your sending domain is verified in Resend, and **Forgot password** delivers an email.
- [ ] `OPERATOR_NAME` and `CONTACT_EMAIL` are set, and you've read the [Privacy](/privacy) and [Terms](/terms) pages (have them reviewed if you run a commercial service).
- [ ] Upload a font, publish it and load its CSS link from another site.
- [ ] Try [/convert](/convert) and [/icons](/icons) signed out.
- [ ] An uptime monitor checks `https://your-domain/api/health`.
- [ ] Search engines can read `https://your-domain/sitemap.xml` (submit it in Google Search Console).

## Recommended for production

- **A custom domain**, for example `fonts.example.com`, so font URLs stay stable if you move hosting. Set `NEXT_PUBLIC_APP_URL` to it.
- **Vercel Pro** for real traffic. Processing routes use up to 300 seconds, and the CDN absorbs CSS and font requests.
- **A Google Fonts API key** (`GOOGLE_FONTS_API_KEY`) if you want the live catalogue instead of the bundled snapshot.

## How requests are served

| Request | Cache |
| --- | --- |
| `/fonts/{workspace}/css?…` | CDN for 5 minutes, served stale for up to a day while it refreshes |
| `/fonts/files/{name}` | Immutable, cached for a year |
| `/fonts/{workspace}/tokens.css` | CDN for 1 minute, stale-while-revalidate |

A publish or rollback reaches every site within about five minutes.
