import { expect, test } from '@playwright/test';
import { signIn, signOut, signUp } from './helpers';

test('sign up, sign out, sign in, and reject a wrong password', async ({ page }) => {
  const { email, password } = await signUp(page);
  await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible();
  await signOut(page);

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Email or password is incorrect.')).toBeVisible();

  await signIn(page, email, password);
});

test('reset a forgotten password and sign out other sessions', async ({ page, browser }) => {
  const { email, password } = await signUp(page);

  // A second device that is signed in before the reset.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage, email, password);

  await signOut(page);
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  // EXPOSE_RESET_LINKS=true shows the link instead of emailing it.
  const link = await page.locator('a[href*="/reset-password?token="]').getAttribute('href');
  expect(link).toBeTruthy();
  await page.goto(link!);
  await page.getByLabel('New password', { exact: true }).fill('a-brand-new-password');
  await page.getByLabel('Confirm new password').fill('a-brand-new-password');
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page).toHaveURL(/\/w\//);

  // The link only works once.
  await page.context().clearCookies();
  await page.goto(link!);
  await page.getByLabel('New password', { exact: true }).fill('another-password-123');
  await page.getByLabel('Confirm new password').fill('another-password-123');
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page.getByText('This reset link is invalid or has expired.', { exact: false })).toBeVisible();

  // The other device's session ended with the reset.
  await otherPage.reload();
  await expect(otherPage).toHaveURL(/\/login/);
  await other.close();

  await signIn(page, email, 'a-brand-new-password');
});

test('change password from the account page', async ({ page }) => {
  const { email, password } = await signUp(page);
  await page.getByRole('link', { name: 'Account' }).click();
  await page.getByLabel('Current password').fill(password);
  await page.getByLabel('New password', { exact: true }).fill('changed-password-456');
  await page.getByLabel('Confirm new password').fill('changed-password-456');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText('Password changed.')).toBeVisible();
  // Still signed in on this device.
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
  await page.context().clearCookies();
  await signIn(page, email, 'changed-password-456');
});

test('too many failed sign-ins for one account are rate limited', async ({ request }) => {
  const email = `nobody-${Date.now()}@example.com`;
  const statuses: number[] = [];
  for (let i = 0; i < 12; i++) {
    const res = await request.post('/api/auth/login', { data: { email, password: 'nope' } });
    statuses.push(res.status());
  }
  expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
  expect(statuses.at(-1)).toBe(429);
});
