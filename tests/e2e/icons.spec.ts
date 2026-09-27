import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { unzipSync } from 'fflate';
import { signUp } from './helpers';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M2 2h20v20H2zM8 8h8v8H8z"/></svg>';

test('build an icon font from a set and an uploaded SVG', async ({ page }) => {
  await page.goto('/icons');
  await expect(page.getByRole('heading', { name: 'Icon font generator', level: 1 })).toBeVisible();

  await page.getByLabel('Search icons').fill('arrow left');
  const results = page.getByTestId('icon-results');
  await expect(results.getByRole('button', { name: /^arrow-left \(Material Design Icons/ })).toBeVisible();
  await results.getByRole('button', { name: /^arrow-left \(Material Design Icons/ }).click();
  await expect(results.getByRole('button', { name: /^arrow-left \(Material Design Icons/ })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('tab', { name: 'Upload SVG' }).click();
  await page.getByLabel('Choose SVG files').setInputFiles({ name: 'My Logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG) });
  const list = page.getByRole('list', { name: 'Icons in your font' });
  await expect(list.getByLabel('Icon name')).toHaveCount(2);
  await expect(list.getByLabel('Icon name').nth(1)).toHaveValue('my-logo');
  await expect(list.getByLabel('Code point (hex)').nth(1)).toHaveValue('e801');

  await page.getByRole('textbox', { name: 'Font name' }).fill('acme');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download font' }).click();
  const file = await (await download).path();
  const zip = unzipSync(readFileSync(file));
  expect(Object.keys(zip)).toEqual(expect.arrayContaining(['acme-icons/font/acme.woff2', 'acme-icons/css/acme.css', 'acme-icons/config.json']));
  const css = new TextDecoder().decode(zip['acme-icons/css/acme.css']);
  expect(css).toContain(".icon-arrow-left:before { content: '\\e800'; }");
  expect(css).toContain(".icon-my-logo:before { content: '\\e801'; }");

  // The selection is kept in the browser.
  await page.reload();
  await expect(page.getByRole('list', { name: 'Icons in your font' }).getByLabel('Icon name')).toHaveCount(2);
});

test('publish an icon font from a workspace', async ({ page, request }) => {
  const { slug } = await signUp(page);
  await page.getByRole('link', { name: 'Icon fonts' }).click();
  await expect(page.getByRole('heading', { name: 'Icon fonts', level: 1 })).toBeVisible();
  page.once('dialog', (d) => d.accept('brand'));
  await page.getByRole('button', { name: 'New icon font' }).first().click();
  await expect(page.getByRole('heading', { name: 'brand', level: 1 })).toBeVisible();

  await page.getByLabel('Search icons').fill('home');
  await page.getByTestId('icon-results').getByRole('button').first().click();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Published. The stylesheet is live.')).toBeVisible();

  const res = await request.get(`/fonts/${slug}/icons/brand.css`);
  expect(res.status()).toBe(200);
  const css = await res.text();
  expect(css).toContain(`font-family: 'brand'`);
  expect(css).toMatch(/content: '\\e800'/);
  const woff2 = /url\('([^']+\.woff2)'\)/.exec(css)![1];
  const font = await request.get(woff2);
  expect(font.status()).toBe(200);
  expect(font.headers()['content-type']).toBe('font/woff2');

  await page.goto(`/w/${slug}/icons`);
  await expect(page.getByText('Published', { exact: true })).toBeVisible();
});
