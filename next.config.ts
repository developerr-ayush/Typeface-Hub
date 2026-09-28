import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Font processing relies on WASM (HarfBuzz, WOFF2) loaded from node_modules at runtime.
  serverExternalPackages: ['subset-font', 'harfbuzzjs', 'fontverter', 'wawoff2', 'fontkit', 'undici'],
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/harfbuzzjs/dist/*.wasm', './src/data/icons/*.json'],
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
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
