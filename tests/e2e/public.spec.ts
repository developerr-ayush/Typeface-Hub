import { expect, test } from '@playwright/test';
import { FIXTURE } from './helpers';

test('public pages load', async ({ page }) => {
  for (const path of ['/', '/convert', '/docs', '/docs/css-api', '/about', '/privacy', '/terms', '/changelog', '/login', '/signup', '/forgot-password']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
  await page.goto('/docs');
  await page.getByRole('link', { name: 'Variable fonts' }).first().click();
  await expect(page.getByRole('heading', { name: 'Variable fonts', level: 1 })).toBeVisible();
});

test('the free converter inspects, previews and converts a font', async ({ page }) => {
  await page.goto('/convert');
  await page.setInputFiles('input[type=file]', FIXTURE);
  await expect(page.getByText('0 variable · 1 static')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible();
  await page.getByText('I’m allowed to convert').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Convert & download' }).click()]);
  expect(download.suggestedFilename()).toBe('bakbak-one-webfont-kit.zip');
  await expect(page.getByText('Your kit is downloading')).toBeVisible();
});
