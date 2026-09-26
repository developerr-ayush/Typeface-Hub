import { z } from 'zod';

/** Kit options accepted by the public converter and the kit API. */
export const KitOptionsSchema = z.object({
  formats: z.array(z.enum(['woff2', 'woff', 'sfnt'])).min(1).default(['woff2', 'woff']),
  characters: z.enum(['full', 'split', 'latin', 'latin-ext', 'custom']).default('latin-ext'),
  customText: z.string().max(2000).optional(),
  variable: z.enum(['variable', 'static']).default('variable'),
  staticWeights: z.array(z.number().int().min(1).max(1000)).max(20).optional(),
  axes: z.record(z.string().regex(/^[A-Za-z0-9]{4}$/), z.union([z.number(), z.object({ min: z.number(), max: z.number() })])).optional(),
  pathPrefix: z.string().max(200).regex(/^[\w./-]*$/, 'Use a relative or absolute path such as ../fonts/').default('../fonts/'),
  display: z.enum(['auto', 'block', 'swap', 'fallback', 'optional']).default('swap'),
  fallback: z.boolean().default(true),
  unicodeRange: z.boolean().default(true),
  demo: z.boolean().default(true),
});
