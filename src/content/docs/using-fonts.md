---
title: Using fonts on your site
description: Add the stylesheet, preload what matters, and set fallbacks and CSP.
---

# Using fonts on your site

## The stylesheet

Each published family is served by the CSS API. One `<link>` can load several families:

```html
<link rel="stylesheet" href="https://fonts.example.com/fonts/acme/css?family=Montserrat:ital,wght@0,400;0,700;1,400&family=Bakbak+One&display=swap">
```

The family's **Use** tab builds this link for you. The full syntax is in the [CSS API reference](/docs/css-api).

## What the browser downloads

The stylesheet declares one `@font-face` per face per script (Latin, Latin Extended, Cyrillic, …), each with a `unicode-range`. The browser downloads a file only when text in that range is actually rendered, so an English page loads only the Latin files.

Each rule lists WOFF2 first and WOFF second; browsers download only the first format they support.

## Preload the first face

For text that is visible without scrolling, preload its Latin WOFF2 so it starts downloading before the CSS is parsed:

```html
<link rel="preload" href="https://fonts.example.com/fonts/files/montserrat-vf-latin.a8f3c1d2e4.woff2" as="font" type="font/woff2" crossorigin>
```

The **Use** tab includes the right preload line. Preload at most one or two files; preloading everything slows the page down.

## Fallback fonts

For every self-hosted family the stylesheet also declares a metric-matched fallback:

```css
@font-face {
  font-family: 'Montserrat Fallback';
  src: local('Arial');
  size-adjust: 110.46%;
  ascent-override: 87.63%;
  descent-override: 22.72%;
  line-gap-override: 0%;
}
```

Put it straight after the family in your stack. While the web font loads, text is shown in Arial resized to Montserrat's proportions, so the layout barely moves when Montserrat arrives:

```css
font-family: 'Montserrat', 'Montserrat Fallback', system-ui, sans-serif;
```

## font-display

Each family has a default `font-display` (usually `swap`), which you can change in its settings or override per request with `&display=`. Use `swap` for body text and `optional` for decorative fonts that aren't worth a late swap.

## Content Security Policy

Self-hosted fonts need only your Typeface Hub domain:

```text
style-src 'self' https://fonts.example.com;
font-src 'self' https://fonts.example.com;
```

If you use a family delivered from Google Fonts, also allow `https://fonts.googleapis.com` (styles) and `https://fonts.gstatic.com` (fonts), and add a preconnect:

```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

## Using typography roles instead of family names

Rather than naming families in your CSS, load the token stylesheet and use roles:

```html
<link rel="stylesheet" href="https://fonts.example.com/fonts/acme/tokens.css?theme=default">
```

```css
h1 { font: var(--text-h1-weight) var(--text-h1-size)/var(--text-h1-line-height) var(--font-heading); }
```

A rebrand is then one change in **Typography**. See [Typography tokens](/docs/typography-tokens).
