import { ApiKeys } from '@/components/api-keys';
import { Card, CardHeader, CodeBlock, PageHeader } from '@/components/ui';
import { getWorkspaceActor } from '@/lib/context';
import { requestOrigin } from '@/lib/delivery';
import { listApiKeys } from '@/lib/workspaces';

export const metadata = { title: 'Developers' };

const endpoints: [string, string, string][] = [
  ['POST', '/api/v1/uploads', 'Upload font files (multipart “files”); returns upload refs'],
  ['POST', '/api/v1/uploads/analyze', 'Read metadata and group uploaded files into families'],
  ['POST', '/api/v1/families/uploads', 'Process uploaded files; returns a job id'],
  ['GET', '/api/v1/jobs/{id}', 'Processing status and report'],
  ['POST', '/api/v1/jobs/{id}/retry', 'Retry a failed job'],
  ['POST', '/api/v1/families/google', 'Add a Google family (mode: external | import)'],
  ['POST', '/api/v1/families/custom-url', 'Add from a stylesheet URL or pasted CSS (legacy import)'],
  ['GET', '/api/v1/families', 'List and filter the library (q, source, type, status, tag, licence, used, limit, offset)'],
  ['GET / PATCH / DELETE', '/api/v1/families/{id}', 'Read, edit (names, fallback, display, tags, licence) or delete a family'],
  ['PATCH', '/api/v1/families/{id}/faces/{faceId}', 'Correct a face in a draft version'],
  ['POST', '/api/v1/families/{id}/versions/{v}/publish', 'Publish a draft version'],
  ['DELETE', '/api/v1/families/{id}/versions/{v}', 'Discard a draft version'],
  ['POST', '/api/v1/families/{id}/rollback', 'Roll back to a previous version { version }'],
  ['POST', '/api/v1/families/{id}/archive', 'Archive or restore { archived }'],
  ['POST', '/api/v1/families/{id}/reprocess', 'Limit or pin variable axes into a new draft'],
  ['POST', '/api/v1/families/{id}/kit', 'Download a web font kit (ZIP): fonts in WOFF2/WOFF/TTF, CSS, demo page, README'],
  ['GET / PUT / DELETE', '/api/v1/tokens/{theme}', 'Read (format=raw|json|css) or update typography tokens'],
  ['GET', '/api/v1/sdui', 'SDUI contract for a theme (theme, styles, preload)'],
  ['GET', '/api/v1/google', 'Search the Google Fonts catalogue'],
  ['GET', '/api/v1/audit', 'Audit log'],
  ['GET', '/api/v1/stats', 'CSS API and pipeline metrics'],
  ['GET', '/fonts/{workspace}/css', 'Public CSS API (Google CSS2 syntax)'],
  ['GET', '/fonts/{workspace}/tokens.css', 'Public token stylesheet (theme)'],
  ['GET', '/fonts/files/{name}', 'Immutable, content-hashed font files'],
];

export default async function DevelopersPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const actor = await getWorkspaceActor(ws);
  const origin = await requestOrigin();
  const keys = actor.can('settings') ? await listApiKeys(actor.workspace.id) : [];

  return (
    <>
      <PageHeader title="Developers" description="Everything a site, app or build pipeline needs to consume this workspace’s fonts and tokens." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="CSS API" description="Drop one stylesheet into any page. Request only the faces the page renders; browsers then download only the unicode ranges they need." />
          <div className="space-y-3 px-5 py-4">
            <CodeBlock
              label="HTML"
              code={`<link rel="stylesheet" href="${origin}/fonts/${ws}/css?family=Montserrat:ital,wght@0,400;0,700;1,400&family=Bakbak+One&display=swap">
<link rel="stylesheet" href="${origin}/fonts/${ws}/tokens.css?theme=default">

<h1 class="text-h1">Uses var(--font-heading)</h1>
<p style="font-family: var(--font-body)">Body copy</p>`}
            />
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted">
              <li>
                <code>family=Name:wght@400;700</code> static weights · <code>wght@100..900</code> a variable range · <code>ital,wght@0,400;1,400</code> italics · several <code>family</code> params in one request.
              </li>
              <li>
                <code>display=swap|optional|fallback|block|auto</code> overrides the family default. <code>subset=latin,latin-ext</code> restricts the unicode ranges declared.
              </li>
              <li>Every internal family also gets a metric-matched <code>&apos;Name Fallback&apos;</code> face to reduce layout shift while the font loads.</li>
            </ul>
          </div>
        </Card>

        <Card>
          <CardHeader title="SDUI and server rendering" description="The render API asks for the fonts a page uses and gets back one CSS URL, up to two preloads and preconnects only when an external provider is involved." />
          <div className="grid gap-4 px-5 py-4 lg:grid-cols-2">
            <CodeBlock
              label="Request"
              code={`curl ${origin}/api/v1/sdui?theme=default&styles=h1,body,button \\
  -H "Authorization: Bearer $TYPEFACE_KEY"`}
            />
            <CodeBlock
              label="Response"
              code={`{
  "fonts": {
    "css": ["${origin}/fonts/${ws}/css?family=Montserrat:wght@400;700&display=swap"],
    "preload": ["${origin}/fonts/files/montserrat-vf-latin.a8f3c1d2e4.woff2"],
    "preconnect": []
  },
  "typography": { "theme": "default", "css": "…/tokens.css", "tokens": { … } }
}`}
            />
            <CodeBlock
              className="lg:col-span-2"
              label="Next.js (app/layout.tsx)"
              code={`const sdui = await fetch('${origin}/api/v1/sdui?theme=default', {
  headers: { Authorization: \`Bearer \${process.env.TYPEFACE_KEY}\` },
  next: { revalidate: 300 },
}).then((r) => r.json());

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {sdui.fonts.preconnect.map((href) => <link key={href} rel="preconnect" href={href} crossOrigin="" />)}
        {sdui.fonts.preload.map((href) => <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="" />)}
        {sdui.fonts.css.map((href) => <link key={href} rel="stylesheet" href={href} />)}
        <link rel="stylesheet" href={sdui.typography.css} />
      </head>
      <body>{children}</body>
    </html>
  );
}`}
            />
          </div>
        </Card>

        {actor.can('settings') ? (
          <ApiKeys ws={ws} initial={keys.map((k) => ({ ...k, createdAt: k.createdAt.toISOString(), lastUsedAt: k.lastUsedAt?.toISOString() ?? null }))} />
        ) : (
          <Card className="p-5 text-sm text-muted">Ask a workspace admin for an API key.</Card>
        )}

        <Card>
          <CardHeader title="REST API" description={<>Authenticate with <code>Authorization: Bearer &lt;key&gt;</code>. Responses are JSON; errors look like <code>{'{ "error": { "message": "…" } }'}</code>.</>} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {endpoints.map(([m, p, d]) => (
                  <tr key={`${m}${p}`} className="border-t border-line first:border-0">
                    <td className="px-5 py-2 align-top text-xs font-semibold whitespace-nowrap text-accent">{m}</td>
                    <td className="px-3 py-2 align-top">
                      <code className="text-[12.5px] text-ink">{p}</code>
                    </td>
                    <td className="px-3 py-2 align-top text-[13px] text-muted">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
