---
title: Migrating existing fonts
description: Import fonts from existing CSS, such as Transfonter exports.
---

# Migrating existing fonts

If your fonts already live somewhere as a CSS file plus font files, you can import them without re-uploading anything by hand.

## From stored CSS (Transfonter and similar)

1. Open **Add font → Stylesheet & legacy import** and choose **Paste CSS (legacy import)**.
2. Paste the CSS. Typical Transfonter output lists EOT, WOFF2, WOFF, TTF and SVG for each weight; that's fine.
3. If the `url(...)` values are relative, enter the **base URL** the files are served from, for example `https://cdn.example.com/static-assets/fonts/typography/montserrat/`.
4. Click **Read stylesheet**. The families and faces found are listed with their formats.
5. Tick the families to import, confirm the licence, and click **Import**.

For each face, the best source is downloaded (TTF/OTF, then WOFF2, then WOFF). EOT and SVG are ignored. Duplicate declarations of the same face are skipped with a warning.

## From a ZIP

Upload the original export ZIP on the **Upload files** tab. Only the font files inside are used, and when a face exists in several formats the best one is kept.

## Recommended rollout

1. Import each family. It becomes version 1 as a draft.
2. Compare the specimen with the current site, then publish.
3. Switch one property at a time to the new CSS link (or SDUI fields), behind a feature flag if you have one.
4. Keep the old font URLs working until every property has moved.

## Checking the result

On the review screen, check:

- every weight you expected is there, with the right style
- warnings about weight classes that don't match their names (common in older fonts)
- the size saving compared with the original files
