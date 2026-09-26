import { expect, test } from '@playwright/test';
import { FIXTURE, signUp } from './helpers';

test('upload, process, publish, then serve the font through the CSS API', async ({ page, request }) => {
  const { slug } = await signUp(page);
  await page.getByRole('link', { name: 'Add your first font' }).click();
  await page.setInputFiles('input[type=file]', FIXTURE);
  await expect(page.getByText('Detected faces')).toBeVisible();
  await expect(page.getByLabel('Family for BakbakOne-Regular.ttf')).toHaveValue('Bakbak One');
  await page.getByText('I confirm we are licensed').click();
  await page.getByRole('button', { name: 'Process 1 file' }).click();

  await page.getByRole('link', { name: 'Review & publish' }).click({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Publish v1' }).click();
  await page.locator('dialog').getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Live: v1')).toBeVisible();

  const css = await request.get(`/fonts/${slug}/css?family=Bakbak+One`);
  expect(css.status()).toBe(200);
  const body = await css.text();
  expect(body).toContain("font-family: 'Bakbak One'");
  expect(body).toContain("'Bakbak One Fallback'");
  const file = /url\((https?:[^)]+latin\.[a-f0-9]{10}\.woff2)\)/.exec(body)?.[1];
  expect(file).toBeTruthy();
  const font = await request.get(file!.replace(/^https?:\/\/[^/]+/, ''));
  expect(font.status()).toBe(200);
  expect(font.headers()['content-type']).toBe('font/woff2');
  expect(font.headers()['cache-control']).toContain('immutable');

  // The kit downloads from the Use tab.
  await page.getByRole('button', { name: 'Download kit' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download ZIP' }).click()]);
  expect(download.suggestedFilename()).toMatch(/bakbak-one-webfont-kit-v1\.zip/);
});
