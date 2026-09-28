/**
 * Family names end up inside generated CSS (the CSS API, token stylesheets,
 * kits), so names from uploads and imported stylesheets are cleaned before
 * they are stored, and every name is escaped when it is written out.
 */

/** Remove characters that could break out of a CSS string or rule; collapse whitespace. */
export function cleanCssName(name: string, fallback = 'Font') {
  const clean = name
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f'"`;{}<>\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return clean || fallback;
}

/** A single-quoted CSS string with quotes, backslashes, control characters and "<" escaped. */
export function cssQuote(s: string) {
  return `'${s.replace(/[\\']/g, (c) => `\\${c}`).replace(/[\u0000-\u001f\u007f<>]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `)}'`;
}
