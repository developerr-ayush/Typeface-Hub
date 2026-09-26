---
title: CSS API
description: Public stylesheet endpoint with Google Fonts CSS2 syntax.
---

# CSS API

```text
GET /fonts/{workspace}/css?family=…&display=…
```

Public, no key needed. Returns a stylesheet with `@font-face` rules for the requested published families.

## The family parameter

The syntax matches [Google Fonts CSS2](https://developers.google.com/fonts/docs/css2). Spaces in names become `+`.

| Request | Meaning |
| --- | --- |
| `family=Bakbak+One` | The regular (400, normal) face, or the closest one |
| `family=Montserrat:wght@400;700` | Weights 400 and 700 |
| `family=Montserrat:wght@300..700` | A variable weight range |
| `family=Montserrat:ital,wght@0,400;1,400;1,700` | Roman 400, italic 400 and italic 700 |
| `family=Open+Sans:wdth,wght@75,400;100,700` | Width and weight together |

- Axis tags come first, comma separated, then `@`, then tuples separated by `;`. Each tuple has one value per tag.
- Values are a number, or `min..max` for a range.
- Repeat `family=` to load several families in one request.

## Other parameters

| Parameter | Values | Default |
| --- | --- | --- |
| `display` | `swap`, `optional`, `fallback`, `block`, `auto` | The family's setting (usually `swap`) |
| `subset` | Comma-separated subsets, e.g. `latin,latin-ext` | All subsets the font has |

## What you get back

For each matching face and each script subset:

```css
/* latin */
@font-face {
  font-family: 'Montserrat';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url(https://fonts.example.com/fonts/files/montserrat-vf-latin.d5e10f32b5.woff2) format('woff2'),
       url(https://fonts.example.com/fonts/files/montserrat-vf-latin.1f0e3c7a9b.woff) format('woff');
  unicode-range: U+0000-00FF, U+0131, …;
}
```

Followed by a metric-matched fallback face (`'Montserrat Fallback'`) for self-hosted families.

- **Variable faces** get the requested range, for example `font-weight: 400 700`.
- **Subsets** are declared with Latin last, so shared characters come from the Latin file.
- **External families** (loaded from Google Fonts or a stylesheet URL) are included with `@import` at the top of the response.

## Missing faces and errors

- Weights or families that don't exist are listed in a comment at the top: `/* Not served: Lato: no normal 900 face */`. The rest of the stylesheet is still returned.
- If nothing at all can be served, or the query is malformed, the status is `400` with the reason in a CSS comment.
- Only **published** versions are served. Drafts and archived families are never included.

## Caching and headers

| Header | Value |
| --- | --- |
| `Cache-Control` | `public, max-age=600, s-maxage=300, stale-while-revalidate=86400, stale-if-error=604800` |
| `Access-Control-Allow-Origin` | `*` |
| `Content-Type` | `text/css; charset=utf-8` |

## Font files

```text
GET /fonts/files/{name}
```

File names are content-hashed, such as `montserrat-vf-latin.d5e10f32b5.woff2`, so they are served with `Cache-Control: public, max-age=31536000, immutable` and CORS enabled.

## Token stylesheet

```text
GET /fonts/{workspace}/tokens.css?theme=default
```

CSS custom properties and `.text-*` classes for a theme. See [Typography tokens](/docs/typography-tokens).
