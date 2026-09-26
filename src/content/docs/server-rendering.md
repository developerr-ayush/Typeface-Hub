---
title: SDUI and server rendering
description: Let your render API ask for exactly the fonts a page uses.
---

# SDUI and server rendering

If pages are rendered by a server or a render API, it can ask Typeface Hub for exactly the fonts a page uses and write them into the document head. Fonts then start downloading with the HTML, with no flash of fallback text.

## The SDUI endpoint

```bash
curl "https://fonts.example.com/api/v1/sdui?theme=default&styles=h1,body,button&preload=h1,body" \
  -H "Authorization: Bearer $TYPEFACE_KEY"
```

| Parameter | Meaning |
| --- | --- |
| `theme` | Token theme (default `default`) |
| `styles` | Text styles used on the page; omit for all |
| `preload` | Styles that are above the fold, in priority order (default `h1,body`) |

Response:

```json
{
  "fonts": {
    "css": ["https://fonts.example.com/fonts/acme/css?family=Bakbak+One:wght@400&family=Montserrat:wght@400;700&display=swap"],
    "preload": ["https://fonts.example.com/fonts/files/bakbak-one-400-latin.adedf62807.woff2"],
    "preconnect": []
  },
  "typography": {
    "theme": "default",
    "css": "https://fonts.example.com/fonts/acme/tokens.css?theme=default",
    "tokens": { "roles": { … }, "styles": { … } }
  },
  "faces": [{ "family": "Montserrat", "weight": 700, "style": "normal", "usedBy": ["button"] }]
}
```

- `fonts.css`: one stylesheet URL for all faces the chosen styles use
- `fonts.preload`: at most two Latin WOFF2 files for above-the-fold styles
- `fonts.preconnect`: only when a family is delivered by an external provider
- `typography.tokens`: the JSON tokens, for native or custom renderers

Use a **delivery** API key (read-only). Create one in **Developers → API keys**.

## Next.js (App Router)

```tsx
// app/layout.tsx
const sdui = await fetch(`${process.env.TYPEFACE_URL}/api/v1/sdui?theme=default`, {
  headers: { Authorization: `Bearer ${process.env.TYPEFACE_KEY}` },
  next: { revalidate: 300 },
}).then((r) => r.json());

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {sdui.fonts.preconnect.map((href: string) => <link key={href} rel="preconnect" href={href} crossOrigin="" />)}
        {sdui.fonts.preload.map((href: string) => <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="" />)}
        {sdui.fonts.css.map((href: string) => <link key={href} rel="stylesheet" href={href} />)}
        <link rel="stylesheet" href={sdui.typography.css} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

## Other stacks

Any server can do the same: call the endpoint (cache the response for a few minutes), then write `preconnect`, `preload` and `stylesheet` links into the head. For a page-specific set, pass the styles that page uses in `styles`.
