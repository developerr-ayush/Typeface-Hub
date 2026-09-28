import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Marked, type Tokens } from 'marked';

export interface Heading {
  id: string;
  text: string;
  depth: number;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Render Markdown to HTML with heading anchors, callouts and safe links. */
export function renderMarkdown(source: string) {
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }: Tokens.Heading) {
        const html = this.parser.parseInline(tokens);
        const text = html.replace(/<[^>]+>/g, '');
        let id = slug(text);
        const n = used.get(id) ?? 0;
        used.set(id, n + 1);
        if (n) id = `${id}-${n}`;
        if (depth === 2 || depth === 3) headings.push({ id, text, depth });
        return `<h${depth} id="${id}"><a href="#${id}" class="anchor" aria-hidden="true">#</a>${html}</h${depth}>\n`;
      },
      code({ text, lang }: Tokens.Code) {
        return `<div class="code"><div class="code-bar"><span>${escapeHtml(lang ?? '')}</span><button type="button" class="copy-code">Copy</button></div><pre><code>${escapeHtml(text)}</code></pre></div>\n`;
      },
      blockquote({ tokens }: Tokens.Blockquote) {
        const body = this.parser.parse(tokens);
        const kind = /^<p><strong>(Note|Tip|Warning|Important)<\/strong>/i.exec(body)?.[1]?.toLowerCase() ?? 'note';
        return `<div class="callout callout-${kind}">${body}</div>\n`;
      },
      link({ href, title, tokens }: Tokens.Link) {
        const text = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href);
        return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ''}${external ? ' target="_blank" rel="noreferrer"' : ''}>${text}</a>`;
      },
      table(token: Tokens.Table) {
        const cell = (c: Tokens.TableCell) => this.parser.parseInline(c.tokens);
        const head = `<tr>${token.header.map((c) => `<th>${cell(c)}</th>`).join('')}</tr>`;
        const rows = token.rows.map((r) => `<tr>${r.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`).join('');
        return `<div class="table-wrap"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>\n`;
      },
    },
  });
  const html = marked.parse(source, { async: false }) as string;
  return { html, headings };
}

/**
 * Legal and about pages name whoever runs the service: {{operator}} and {{contact}}
 * come from OPERATOR_NAME and CONTACT_EMAIL, so a deployment doesn't need to edit Markdown.
 */
function withOperator(md: string) {
  const operator = process.env.OPERATOR_NAME?.trim() || 'the team that runs this site';
  const email = process.env.CONTACT_EMAIL?.trim();
  const contact = email ? `[${email}](mailto:${email})` : '[GitHub](https://github.com/developerr-ayush/Typeface-Hub/issues)';
  return md.replaceAll('{{operator}}', operator).replaceAll('{{contact}}', contact);
}

/** Read a Markdown file from src/content with optional front matter (title, description). */
export async function loadContent(path: string) {
  const raw = await readFile(join(process.cwd(), 'src', 'content', path), 'utf8');
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw);
  const meta: Record<string, string> = {};
  if (fm) for (const line of fm[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const body = withOperator(fm ? raw.slice(fm[0].length) : raw);
  return { meta: meta as { title?: string; description?: string; updated?: string }, ...renderMarkdown(body) };
}
