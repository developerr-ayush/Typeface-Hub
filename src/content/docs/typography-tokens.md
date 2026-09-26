---
title: Typography tokens
description: Font roles, text styles, responsive and fluid sizes, themes, and output formats.
---

# Typography tokens

Tokens sit on top of the library. Widgets and pages reference roles like *heading* instead of hard-coded family names, so a rebrand is a single change.

## Font roles

A role maps to a family and a fallback stack. Every workspace starts with **heading**, **body**, **display** and **mono**, and you can add your own (for example `accent`).

A role pointing to a family that isn't published yet resolves to its fallback stack only, and is flagged *not live*.

## Text styles

Each text style has:

| Setting | Notes |
| --- | --- |
| Role | Which font role it uses |
| Weight and style | `normal` or `italic` |
| Size | In rem, separately for mobile, tablet and desktop |
| Line height | Unitless |
| Letter spacing | In em |
| Transform | `none`, `uppercase`, `lowercase`, `capitalize` |
| Fluid | Interpolate between the mobile and desktop sizes with `clamp()` |

The defaults are H1–H6, body, caption, button and label. Add your own with **Add text style**.

### Breakpoints

Sizes are mobile first: the mobile size is the base, and tablet and desktop sizes apply from their breakpoints (768 px and 1200 px by default).

### Type scale

**Type scale** fills the heading sizes from a base size and a ratio (for example Major third, 1.25). Adjust individual sizes afterwards.

### Accessibility checks

Warnings appear when body text is below 16 px, body line height is below 1.4, text weights are very light, or letter spacing is very tight.

## Themes

A theme is a separate token set, for example a sub-brand or a women's team. Create one with **New theme**; it starts as a copy of the current theme.

## Output

| Format | Where |
| --- | --- |
| CSS custom properties + `.text-*` classes | `GET /fonts/{workspace}/tokens.css?theme=default` |
| JSON | `GET /api/v1/tokens/{theme}?format=json` |
| SDUI contract | `GET /api/v1/sdui?theme=default` |

Example CSS output:

```css
:root {
  --font-heading: 'Bakbak One', 'Bakbak One Fallback', system-ui, sans-serif;
  --font-body: 'Montserrat', 'Montserrat Fallback', system-ui, sans-serif;
  --text-h1-family: var(--font-heading);
  --text-h1-size: clamp(2.25rem, 1.7143rem + 2.381vw, 3.5rem);
  --text-h1-weight: 700;
  --text-h1-line-height: 1.1;
}
.text-h1 {
  font-family: var(--text-h1-family);
  font-size: var(--text-h1-size);
  font-weight: var(--text-h1-weight);
  line-height: var(--text-h1-line-height);
}
```

Saved tokens reach the token stylesheet within about a minute.
