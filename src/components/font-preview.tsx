import { googleCssUrl } from '@/lib/css-api';

/** Loads the files a server-rendered preview needs: inline @font-face for internal fonts, provider CSS for external ones. */
export function PreviewStyles({ css, links }: { css?: string; links?: string[] }) {
  return (
    <>
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      {links?.map((href) => <link key={href} rel="stylesheet" href={href} />)}
    </>
  );
}

export function externalPreviewLink(family: { external: { provider: string; family?: string; cssUrl?: string } | null; cssName: string }, text?: string) {
  if (family.external?.provider === 'google') {
    const url = googleCssUrl(family.external.family ?? family.cssName, [{ ital: 0, wght: [100, 900], wdth: null, axes: {} }, { ital: 1, wght: [100, 900], wdth: null, axes: {} }], 'swap');
    return text ? `${url}&text=${encodeURIComponent(text)}` : url;
  }
  return family.external?.cssUrl ?? null;
}
