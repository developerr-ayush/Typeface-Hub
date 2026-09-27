---
title: Privacy
description: What data Typeface Hub collects and how it is used.
updated: 26 September 2026
---

# Privacy policy

> **Important** This page describes how the software handles data. If you operate a public Typeface Hub service, have it reviewed by a lawyer and add your organisation's name and contact details before publishing.

## What we collect

**Accounts.** Your name, email address and a hashed password (bcrypt). We never store your password in plain text. Password-reset links are single-use, expire after an hour, and are stored only as a hash.

**Security limits.** To slow down password guessing and abuse, sign-in, sign-up, password reset and the converter keep short-lived counters keyed by a one-way hash of your network address (and, for sign-in, of the email being used). They expire within the hour.

**Workspace content.** The fonts you upload, the files generated from them, family details, licence records, typography tokens, API keys (stored only as a hash), and an audit log of changes.

**Delivery statistics.** For the CSS API we keep daily totals per workspace: request counts, error counts, latency buckets and which families were requested. We do not store visitor IP addresses, cookies or any other visitor data for these requests.

**Free converter.** Files you convert are processed in memory. When the service runs on Vercel, uploads are placed in temporary storage and deleted right after conversion; anything left behind is removed within an hour. For rate limiting we store a one-way hash of your network address and a counter, which expire within the hour.

**Icon font generator.** On the public page, your icon selection is saved only in your browser's local storage. SVGs are converted in your browser; configs you open and fonts you build are processed in memory and not kept. In a workspace, icon fonts are stored with the workspace like other content.

## Cookies

We set one cookie, `th_session`, to keep you signed in. It is HTTP-only and expires after 30 days. We don't use advertising or tracking cookies.

## Third parties

- **Hosting:** the app, database and file storage run on the operator's hosting (for example Vercel, Neon and Vercel Blob).
- **Email:** if the operator enables it, password-reset emails are sent through Resend.
- **Google Fonts:** only if you choose *Load external* for a Google family do pages request fonts from Google's servers. Workspaces can be set to *self-host only* to prevent this.

## Your choices

- Delete fonts and families at any time; Admins can delete families completely.
- Revoke API keys at any time.
- To delete your account, contact the service operator.

## Changes

We will update this page when data handling changes and show the date of the latest update.
