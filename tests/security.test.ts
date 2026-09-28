import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { isPrivateAddress, safeFetchText } from '@/lib/safe-fetch';
import { getObject } from '@/lib/storage';
import { assertUploadRef, isUploadKey } from '@/lib/uploads';

const WS = '0b6f3c1e-8a52-4d7e-9f10-2c3d4e5f6a7b';
const ID = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';

describe('SSRF guard', () => {
  it('treats private, loopback, link-local and mapped addresses as private', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '::ffff:ac10:1', '64:ff9b::a9fe:a9fe', '::7f00:1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:808:808']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  describe('in production', () => {
    let server: Server;
    let port: number;
    beforeAll(async () => {
      server = createServer((req, res) => {
        if (req.url === '/hop') res.writeHead(302, { Location: '/final' }).end();
        else res.writeHead(200, { 'Content-Type': 'text/css' }).end('/* ok */');
      });
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
      port = (server.address() as AddressInfo).port;
    });
    afterAll(() => new Promise<void>((r) => server.close(() => r())));
    afterEach(() => vi.unstubAllEnvs());

    it('follows redirects when checks are off (development)', async () => {
      expect(await safeFetchText(`http://127.0.0.1:${port}/hop`)).toBe('/* ok */');
    });

    it('refuses IP literals, mapped IPv6 literals and hostnames that resolve to private addresses', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      await expect(safeFetchText(`http://127.0.0.1:${port}/`)).rejects.toThrow(/private network/);
      await expect(safeFetchText(`http://[::ffff:127.0.0.1]:${port}/`)).rejects.toThrow(/private network/);
      await expect(safeFetchText('http://[::ffff:a9fe:a9fe]/latest/meta-data/')).rejects.toThrow(/private network/);
      await expect(safeFetchText(`http://localhost:${port}/`)).rejects.toThrow(/private network/);
      await expect(safeFetchText('file:///etc/passwd')).rejects.toThrow(/Only http/);
    });
  });
});

describe('upload keys', () => {
  it('accepts only uploads/<workspace>/<uuid>/<name>', () => {
    expect(isUploadKey(`uploads/${WS}/${ID}/Brand Sans (Bold).woff2`, WS)).toBe(true);
    for (const key of [
      `uploads/${WS}/../../files/brand.1a2b3c4d5e.woff2`,
      `uploads/${WS}/${ID}/../../../files/x.woff2`,
      `uploads/${WS}/${ID}/..`,
      `uploads/${WS}/${ID}/a/b.ttf`,
      `uploads/${WS}/not-a-uuid/a.ttf`,
      `uploads/${WS}/${ID}/a\\..\\b.ttf`,
      `uploads/other/${ID}/a.ttf`,
    ]) {
      expect(isUploadKey(key, WS), key).toBe(false);
    }
  });

  it('rejects traversal in storage keys and Blob URLs', () => {
    expect(() => assertUploadRef({ key: `uploads/${WS}/../../files/brand.1a2b3c4d5e.woff2`, filename: 'x' }, WS)).toThrow(/does not belong/);
    expect(() => assertUploadRef({ key: `https://abc.public.blob.vercel-storage.com/uploads/${WS}/%2e%2e/%2e%2e/files/x.woff2`, filename: 'x' }, WS)).toThrow(/does not belong/);
    expect(() => assertUploadRef({ key: `https://evil.example/uploads/${WS}/${ID}/a.ttf`, filename: 'x' }, WS)).toThrow(/does not belong/);
    expect(() => assertUploadRef({ key: `https://abc.public.blob.vercel-storage.com/uploads/${WS}/${ID}/Brand%20Sans-Xy12.woff2`, filename: 'x' }, WS)).not.toThrow();
  });

  it('local storage refuses keys that leave their folder', async () => {
    expect(await getObject('uploads/x/../../../package.json')).toBeNull();
    expect(await getObject('../package.json')).toBeNull();
  });
});

describe('CSS names', () => {
  it('cleans names that could break out of generated CSS', async () => {
    const { cleanCssName, cssQuote } = await import('@/lib/css-names');
    expect(cleanCssName("Evil'}\nbody{background:url(//x)}")).toBe('Evil body background:url(//x)');
    expect(cleanCssName('  Brand   Sans  ')).toBe('Brand Sans');
    expect(cleanCssName('\n;')).toBe('Font');
    expect(cssQuote("It's \\ ok\n</style>")).toBe("'It\\'s \\\\ ok\\a \\3c /style\\3e '");
  });
});

describe('password reset origin', () => {
  afterEach(() => vi.unstubAllEnvs());
  const req = new Request('http://real.example/api/auth/forgot', { headers: { 'x-forwarded-host': 'attacker.example' } });

  it('never uses request headers in production', async () => {
    const { trustedOrigin } = await import('@/lib/delivery');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('VERCEL_URL', '');
    expect(trustedOrigin(req)).toBeNull();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://fonts.example.com/');
    expect(trustedOrigin(req)).toBe('https://fonts.example.com');
  });
});

describe('API key scopes', () => {
  it('limits delivery keys to SDUI and tokens', async () => {
    const { scopesCan } = await import('@/lib/permissions');
    expect(scopesCan(['delivery'], 'deliver')).toBe(true);
    expect(scopesCan(['delivery'], 'read')).toBe(false);
    expect(scopesCan(['read'], 'deliver')).toBe(true);
    expect(scopesCan(['read'], 'read')).toBe(true);
  });
});
