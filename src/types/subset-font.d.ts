declare module 'subset-font' {
  interface SubsetOptions {
    targetFormat?: 'sfnt' | 'woff' | 'woff2';
    preserveNameIds?: number[];
    keepFeatures?: string[];
    variationAxes?: Record<string, number | { min: number; max: number; default?: number }>;
    keepAllGlyphs?: boolean;
    noLayoutClosure?: boolean;
    noHinting?: boolean;
    dropTables?: string[];
  }
  export default function subsetFont(buffer: Buffer | Uint8Array, text: string | null, options?: SubsetOptions): Promise<Buffer>;
}
