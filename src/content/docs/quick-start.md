---
title: Quick start
description: Add your first font, publish it and use it on a page in about five minutes.
---

# Quick start

This walkthrough takes you from an empty workspace to a font on a live page.

## 1. Create an account

Go to [Sign up](/signup), enter your name, email and a password, and optionally name your first workspace (for example a client or brand). You land in the workspace's **Library**.

## 2. Add a font

Open **Add font**. You have three options:

- **Upload files.** Drop TTF, OTF, WOFF or WOFF2 files, or a ZIP. One file per weight is enough; a single variable font covers every weight.
- **Google Fonts.** Search, preview and pick a family.
- **Stylesheet & legacy import.** Paste a stylesheet URL, or paste existing CSS to import fonts you already host.

For uploads, Typeface Hub reads each file and shows the detected family, style, weight and axes. Files are grouped into families by their typographic family name; edit the family field to regroup a file. Tick the licence confirmation and click **Process**.

> **Tip** Processing a typical 4-weight family takes a few seconds. You can follow it on the **Jobs** page.

## 3. Review and publish

When processing finishes, click **Review & publish**. The review screen shows:

- every face with its weight, style and axes (editable while the version is a draft)
- the processing report: files created, source size, WOFF2 size and warnings
- a comparison with the live version, if there is one

Click **Publish**. The family is now served by the CSS API.

## 4. Use it on a page

Open the family's **Use** tab, tick the weights you need, and copy the snippet:

```html
<link rel="stylesheet" href="https://your-app.example/fonts/your-workspace/css?family=Montserrat:wght@400;700&display=swap">
```

```css
body { font-family: 'Montserrat', 'Montserrat Fallback', system-ui, sans-serif; }
```

That is all a page needs. Browsers download only the files for characters that actually appear on the page.

## 5. Optional: set up typography tokens

Open **Typography**, map the **heading** and **body** roles to families, adjust the text styles, and click **Save tokens**. Then add the token stylesheet and use roles instead of family names:

```html
<link rel="stylesheet" href="https://your-app.example/fonts/your-workspace/tokens.css?theme=default">
<h1 class="text-h1">Uses var(--font-heading)</h1>
```

## Next steps

- [Variable fonts](/docs/variable-fonts): cap axes to cut bytes.
- [Using fonts on your site](/docs/using-fonts): preloading, fallbacks and CSP.
- [Download kits](/docs/download-kits): get the files and CSS as a ZIP instead.
