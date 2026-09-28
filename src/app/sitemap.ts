import type { MetadataRoute } from 'next';
import { DOCS_PAGES } from '@/content/docs/nav';
import { siteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [string, number][] = [
    ['/', 1],
    ['/convert', 0.9],
    ['/icons', 0.9],
    ['/docs', 0.8],
    ['/about', 0.5],
    ['/changelog', 0.4],
    ['/signup', 0.6],
    ['/privacy', 0.2],
    ['/terms', 0.2],
  ];
  return [
    ...pages.map(([path, priority]) => ({ url: `${siteUrl}${path === '/' ? '' : path}`, changeFrequency: 'weekly' as const, priority })),
    ...DOCS_PAGES.filter((p) => p.slug).map((p) => ({ url: `${siteUrl}/docs/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.6 })),
  ];
}
