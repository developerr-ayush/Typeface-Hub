---
title: Variable fonts
description: Axes, named instances, limiting and pinning axes, and how they map to CSS.
---

# Variable fonts

A variable font holds a whole design space (every weight, sometimes every width, optical size or slant) in one file. Typeface Hub detects this automatically and treats it as a first-class face.

## What is detected

- **Axes** from the font's `fvar` table, each with a minimum, maximum and default: registered axes (`wght`, `wdth`, `opsz`, `slnt`, `ital`) and custom ones (for example `GRAD`).
- **Named instances**, such as *SemiBold* or *Condensed Bold*.

The library, review screen and converter show a **Variable** badge with each axis range, for example *Weight 300–800 · Width 75–100*.

## How axes map to CSS

| Axis | CSS |
| --- | --- |
| Weight `wght` | `font-weight: 650;` |
| Width `wdth` | `font-stretch: 87.5%;` |
| Slant `slnt` | `font-style: oblique 8deg;` |
| Italic `ital` | Usually shipped as a separate italic file; `font-style: italic;` |
| Optical size `opsz` | Chosen automatically from `font-size` (`font-optical-sizing: auto`). To fix it: `font-variation-settings: 'opsz' 32;` |
| Custom axes | `font-variation-settings: 'GRAD' 50;` |

Use the CSS properties for registered axes wherever possible. `font-variation-settings` overrides inheritance and is hard to combine, so keep it for optical size overrides and custom axes.

The generated `@font-face` rules use ranges, for example `font-weight: 100 900;` and `font-stretch: 75% 100%;`, so the browser knows one file covers them all.

## Limiting and pinning axes

You rarely need a font's whole design space. Removing what you don't use can halve the file size.

| Setting | Effect | Example |
| --- | --- | --- |
| Keep full range | Nothing removed | `wght 100–900` |
| Limit range | Keep only part of the axis | `wght 300–700` |
| Pin to value | Remove the axis, fixed at one value | `wdth 100`, `opsz 14` |

For example, capping Open Sans to `wght 300–700` and pinning `wdth` to 100 took its WOFF2 (Latin + Latin Extended) from 122 KB to 55 KB in testing.

Where to set it:

- **In the library:** on the family's **Review** tab, **Limit variable axes** creates a new draft from the original masters.
- **When importing from Google Fonts:** **Cap the weight range**.
- **In download kits and the converter:** per-axis controls.

## Static instances

Some tools (email clients, older design apps) don't support variable fonts. Download kits and the converter can **export static weights**: choose the weights (for example 400 and 700), and every other axis uses the value you pinned, or its default. Each static file gets its own correct internal name, such as *Open Sans Condensed Bold*, so desktop installs don't collide.

## Previewing

- **Type tester:** weight slider that snaps to named instances, plus a slider for every other axis.
- **Converter preview:** sliders stop where your limits cut the font, so you see exactly what the download can do.
- **Kit demo page:** every combination of the kept variants, each with its CSS.
