---
title: Licensing
description: Font licences, what Typeface Hub records, and your responsibilities.
---

# Licensing

Fonts are software, and their licences decide where and how they may be used. Typeface Hub helps you keep track, but it can't decide for you whether a use is allowed.

## Common licences

| Licence | Web self-hosting | Notes |
| --- | --- | --- |
| SIL Open Font License (OFL) | Yes | Most Google Fonts. Keep the licence with the files. |
| Apache 2.0 | Yes | Some Google Fonts. |
| Ubuntu Font Licence (UFL) | Yes | Ubuntu family. |
| Commercial / desktop | Often no | Desktop licences usually don't include web embedding. |
| Commercial / web | Usually, with limits | Often limited by domain or page views. |
| Client-owned | Depends | Check the contract. |

## What Typeface Hub records

- **Confirmation:** every self-hosting path asks you to confirm you are licensed, and records who confirmed and when.
- **Licence record:** Admins can record the type, owner, allowed domains, expiry date, a link to the licence document, and notes on the family's **Settings** tab.
- **Detected information:** the copyright, licence text, licence URL and vendor stored inside the font file, shown alongside the record.
- **Kits:** each kit's README includes the recorded licence details.

The library can be filtered by **Licence recorded** or **Licence missing**.

## Your responsibilities

- Only upload, convert or import fonts you are allowed to use that way.
- Converting a font to another format may count as modifying it under some commercial licences.
- The CSS API URLs are public: anyone with the link can load the font. Domain-based blocking is not built yet, so check commercial licences carefully before publishing.
