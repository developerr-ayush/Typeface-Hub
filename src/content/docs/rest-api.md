---
title: REST API
description: Management API for families, versions, jobs, tokens, kits and more.
---

# REST API

All endpoints live under `/api/v1` and return JSON.

## Authentication

Send an API key as a bearer token:

```bash
curl https://fonts.example.com/api/v1/families -H "Authorization: Bearer th_live_…"
```

Keys belong to one workspace, so no workspace parameter is needed. Create keys in **Developers → API keys**; see [scopes](/docs/workspaces-and-roles#api-keys).

In the browser, the app uses the session cookie plus an `X-Workspace: {slug}` header.

## Errors

```json
{ "error": { "message": "Only draft versions can be published (v2 is published).", "details": {} } }
```

| Status | Meaning |
| --- | --- |
| 400 | Invalid input. The message names the field. |
| 401 | Missing, invalid or revoked key |
| 403 | The key's scope or the member's role doesn't allow this |
| 404 | Not found in this workspace |
| 409 | Conflict, for example a family still in use |
| 429 | Rate limited (public converter) |

## Families

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/families` | List and filter: `q`, `source`, `type`, `status`, `tag`, `licence` (`missing`/`recorded`), `used` (`used`/`unused`), `archived`, `limit`, `offset` |
| GET | `/families/{id}` | A family with its live faces, files, versions, licence and usage |
| PATCH | `/families/{id}` | Edit `displayName`, `cssName`, `category`, `fallbackStack`, `display`, `tags`, `licence` |
| DELETE | `/families/{id}` | Delete (Admin; refused while in use) |
| POST | `/families/{id}/archive` | `{ "archived": true }` to archive, `false` to restore |
| PATCH | `/families/{id}/faces/{faceId}` | Correct `name`, `style`, `weightMin`, `weightMax` in a draft |
| POST | `/families/{id}/versions/{v}/publish` | Publish a draft (`v` is a version id or number) |
| DELETE | `/families/{id}/versions/{v}` | Discard a draft or failed version |
| POST | `/families/{id}/rollback` | `{ "version": 1 }` |
| POST | `/families/{id}/reprocess` | New draft with axis limits: `{ "versionId", "axisLimits": { "wght": { "min": 300, "max": 700 }, "wdth": 100 } }` |
| POST | `/families/{id}/kit` | Download a kit (ZIP). See [Kit options](/docs/kit-options). |

## Adding fonts

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/uploads` | Multipart `files`; returns upload refs |
| POST | `/uploads/analyze` | `{ "files": [refs] }`: metadata, grouping, duplicates |
| POST | `/families/uploads` | `{ "files": [{ key, filename, family }], "licenceConfirmed": true }`: starts a job |
| POST | `/families/google` | `{ "family": "Inter", "mode": "external" \| "import", "styles": ["normal"], "weights": [400, 700], "axisLimits"?, "licenceConfirmed" }` |
| POST | `/families/custom-url/preview` | `{ "url" }` or `{ "css", "baseUrl" }`: lists the families found |
| POST | `/families/custom-url` | `{ "url" \| "css", "baseUrl"?, "mode", "families"?, "legacy"?, "licenceConfirmed" }` |
| GET | `/google` | Search the Google Fonts catalogue: `q`, `category`, `variable`, `limit`, `offset` |

Example upload with curl:

```bash
REFS=$(curl -s -H "Authorization: Bearer $KEY" -F "files=@Montserrat-Bold.ttf" https://fonts.example.com/api/v1/uploads)
curl -s -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d "{\"licenceConfirmed\":true,\"files\":[{\"key\":$(echo $REFS | jq '.files[0].key'),\"filename\":\"Montserrat-Bold.ttf\",\"family\":\"Montserrat\"}]}" \
  https://fonts.example.com/api/v1/families/uploads
```

## Jobs

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/jobs` | Recent jobs |
| GET | `/jobs/{id}` | Status (`queued`, `processing`, `ready`, `failed`), current step, error and reports |
| POST | `/jobs/{id}/retry` | Retry a failed or stuck job |

## Typography

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/tokens/{theme}` | Raw token set; `?format=json` or `?format=css` for outputs |
| PUT | `/tokens/{theme}` | Replace roles, text styles and breakpoints |
| DELETE | `/tokens/{theme}` | Delete a theme (not `default`) |
| GET | `/sdui` | SDUI contract. See [SDUI and server rendering](/docs/server-rendering). |

## Workspace

| Method | Path | Purpose |
| --- | --- | --- |
| GET / PATCH | `/workspace` | Read or update name and settings |
| GET / POST | `/members` | List members; add one by email with a role |
| PATCH / DELETE | `/members/{userId}` | Change role or remove |
| GET / POST | `/api-keys` | List keys; create one (the token is returned once) |
| DELETE | `/api-keys/{id}` | Revoke |
| GET | `/audit` | Audit log: `before`, `target`, `limit` |
| GET | `/stats` | CSS API and pipeline metrics |

## Public endpoints (no key)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/fonts/{workspace}/css` | [CSS API](/docs/css-api) |
| GET | `/fonts/{workspace}/tokens.css` | Token stylesheet |
| GET | `/fonts/files/{name}` | Font files |
| POST | `/api/convert/inspect` | Converter: read uploaded fonts |
| POST | `/api/convert` | Converter: build a kit |
