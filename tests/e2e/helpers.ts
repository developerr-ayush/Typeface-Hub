import { expect, type Page } from '@playwright/test';

export const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
export const FIXTURE = 'tests/fixtures/BakbakOne-Regular.ttf';

/** Sign up through the UI and return the account and workspace slug. */
export async function signUp(page: Page, opts: { workspace?: string } = {}) {
  const email = `${unique('user')}@example.com`;
  const password = 'correct-horse-battery';
  const workspace = opts.workspace ?? unique('Studio');
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Test User');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Workspace name').fill(workspace);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/w\/[^/]+$/);
  const slug = new URL(page.url()).pathname.split('/')[2];
  return { email, password, slug };
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/login/);
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/w\//);
}
