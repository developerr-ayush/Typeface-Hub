/** Docs sidebar. Each slug maps to src/content/docs/<slug>.md ("" is the introduction). */
export const DOCS_NAV: { title: string; items: { slug: string; title: string }[] }[] = [
  {
    title: 'Getting started',
    items: [
      { slug: '', title: 'Introduction' },
      { slug: 'quick-start', title: 'Quick start' },
      { slug: 'run-locally', title: 'Run locally' },
      { slug: 'deploy-vercel', title: 'Deploy to Vercel' },
    ],
  },
  {
    title: 'Guides',
    items: [
      { slug: 'adding-fonts', title: 'Adding fonts' },
      { slug: 'review-and-publish', title: 'Review, publish and roll back' },
      { slug: 'variable-fonts', title: 'Variable fonts' },
      { slug: 'using-fonts', title: 'Using fonts on your site' },
      { slug: 'typography-tokens', title: 'Typography tokens' },
      { slug: 'server-rendering', title: 'SDUI and server rendering' },
      { slug: 'download-kits', title: 'Download kits' },
      { slug: 'converter', title: 'Free converter' },
      { slug: 'icon-fonts', title: 'Icon fonts' },
      { slug: 'migrating', title: 'Migrating existing fonts' },
      { slug: 'workspaces-and-roles', title: 'Workspaces and roles' },
      { slug: 'licensing', title: 'Licensing' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { slug: 'css-api', title: 'CSS API' },
      { slug: 'rest-api', title: 'REST API' },
      { slug: 'kit-options', title: 'Kit options' },
      { slug: 'configuration', title: 'Configuration' },
      { slug: 'limits', title: 'Limits and caching' },
    ],
  },
  {
    title: 'Help',
    items: [
      { slug: 'troubleshooting', title: 'Troubleshooting' },
      { slug: 'faq', title: 'FAQ' },
    ],
  },
];

export const DOCS_PAGES = DOCS_NAV.flatMap((s) => s.items.map((i) => ({ ...i, section: s.title })));
