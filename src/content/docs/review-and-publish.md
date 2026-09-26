---
title: Review, publish and roll back
description: Drafts, the review screen, publishing, rollback and archiving.
---

# Review, publish and roll back

Nothing is served until someone reviews and publishes it. Every change is versioned and reversible.

## The lifecycle

| Status | Meaning |
| --- | --- |
| Processing | Files are being converted. |
| Failed | Processing stopped. The job shows where and why, with a **Retry** button. |
| Draft | Ready for review. Not served. |
| Published | The live version, served by the CSS API. |
| Archived | Not served. Older versions stay available for rollback. |

A family has at most one live version. Uploading new files for it creates the next version as a draft, while the current one stays live.

## The review screen

Open the family and choose **Review & publish** (or the **Review** tab). You see:

- **Summary:** faces, files created, source size, total WOFF2 size, time taken.
- **Warnings:** missing basic Latin characters, weight classes that don't match the style name, missing licence information, and similar.
- **Faces:** a preview of each face with its name, style, weight, axes, subsets and size. While the version is a draft you can correct the name, style and weight; these changes affect the generated CSS only.
- **Compare:** when a live version exists, the two render side by side with the change in Latin WOFF2 size.

## Publishing

Click **Publish v*N***. If no licence has been recorded for the family, you are asked to confirm you may serve it. Publishing:

1. makes the version live for the CSS API, tokens and kits
2. archives the previous live version
3. records the change in the audit log

Pages pick up the new version within about five minutes, as the CDN refreshes the stylesheet. Font file URLs are content-hashed, so old and new files never clash.

Only **Publishers** and **Admins** can publish. See [Workspaces and roles](/docs/workspaces-and-roles).

## Rolling back

On the **Versions** tab, any previously published version shows **Roll back to v*N***. Rollback makes that version live again immediately, with the same five-minute propagation.

## Discarding a draft

A draft or failed version can be discarded from the review screen. If it was the family's only version, the family is removed.

## Archiving and deleting

From **Settings → Danger zone**:

- **Archive** stops serving the family but keeps everything. **Restore** brings it back.
- **Delete** (Admins only) removes the family and all versions.

Neither is allowed while a typography role uses the family. The screen shows where it is used so you can reassign it first.
