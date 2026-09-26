import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Font processing relies on WASM (HarfBuzz, WOFF2) loaded from node_modules at runtime.
  serverExternalPackages: ['subset-font', 'harfbuzzjs', 'fontverter', 'wawoff2', 'fontkit'],
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/harfbuzzjs/dist/*.wasm'],
    '/docs/**/*': ['./src/content/**/*.md'],
    '/(about|privacy|terms|changelog)': ['./src/content/**/*.md'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
