---
title: Workspaces and roles
description: Workspaces, members, roles, API keys and the audit log.
---

# Workspaces and roles

## Workspaces

A workspace is a private font library with its own typography tokens, API keys, settings and audit log, for example one per client or brand. Fonts in one workspace are never visible in another.

Create workspaces from the workspace switcher in the sidebar. The workspace's **slug** appears in its public URLs, for example `/fonts/acme-studio/css`.

### Settings

| Setting | Effect |
| --- | --- |
| Default for Google Fonts | Whether adding a Google family defaults to Load external or Import as internal |
| Self-host only | Blocks external providers so pages make no third-party font requests |

## Roles

| Role | Can |
| --- | --- |
| Viewer | Browse the library, specimens, tokens, jobs and activity |
| Editor | Everything a viewer can, plus add fonts, edit drafts, family details and typography tokens |
| Publisher | Everything an editor can, plus publish, roll back, archive and restore |
| Admin | Everything, plus licences, deletion, members, API keys and workspace settings |

Admins add members by email in **Settings → Members** (the person needs an account first). A workspace always keeps at least one admin.

## API keys

Admins create keys in **Developers → API keys**. Each key belongs to one workspace and has scopes:

| Scope | Allows |
| --- | --- |
| `delivery` | Only the SDUI endpoint and typography tokens (`GET /sdui`, `GET /tokens/{theme}`), using published fonts. Safe for build pipelines and render servers. |
| `read` | Read everything in the management API |
| `write` | Add fonts, edit drafts, families and tokens |
| `publish` | Publish, roll back and archive |

The full key is shown once when it is created. Keys can be revoked at any time.

## Your account

Open **Account** at the bottom of the sidebar to change your name or password. Changing the password signs you out on your other devices. If you forget it, use **Forgot your password?** on the sign-in page.

Sign-in is rate limited: 10 failed attempts for one account, or 20 from one network, within 15 minutes pauses sign-in for that account or network.

## Audit log

**Activity** lists who uploaded, changed, published, rolled back, archived or deleted what, and when, including actions taken with API keys and by the processing pipeline. Each family's **Activity** tab shows its own history.
