import { test as base, expect, Page, BrowserContext } from '@playwright/test';

/**
 * Auth Fixture for ForemanOS E2E Tests
 *
 * Provides authenticated page contexts for testing protected routes.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/auth';
 *
 *   test('can access dashboard', async ({ authenticatedPage }) => {
 *     await authenticatedPage.goto('/dashboard');
 *     await expect(authenticatedPage).toHaveURL('/dashboard');
 *   });
 */

// Test user credentials (from seed.ts)
export const TEST_USERS = {
  admin: {
    username: 'Admin',
    password: '123',
    role: 'admin',
  },
  client: {
    username: 'john',
    password: 'johndoe123',
    role: 'client',
  },
  internal: {
    username: 'internal',
    password: '825',
    role: 'client',
  },
  unapproved: {
    username: 'pendinguser',
    password: 'pending123',
    role: 'pending',
  },
} as const;

type AuthFixture = {
  authenticatedPage: Page;
  adminPage: Page;
  clientPage: Page;
  authenticatedContext: BrowserContext;
};

/**
 * Login helper function
 */
async function loginUser(
  page: Page,
  username: string,
  password: string
): Promise<boolean> {
  await page.goto('/login');

  // Wait for form to be visible
  await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

  // Fill credentials
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);

  // Submit
  await page.locator('button[type="submit"]').first().click();

  // Wait for navigation - successful login should redirect away from login
  try {
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extended test fixture with authenticated pages
 */
export const test = base.extend<AuthFixture>({
  // Authenticated page as default user (admin)
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const { username, password } = TEST_USERS.admin;
    const loginSuccess = await loginUser(page, username, password);

    if (!loginSuccess) {
      console.warn(
        'Warning: Login may have failed. Ensure the test database is seeded.'
      );
    }

    await use(page);
    await context.close();
  },

  // Admin page for admin-specific tests
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const { username, password } = TEST_USERS.admin;
    await loginUser(page, username, password);

    await use(page);
    await context.close();
  },

  // Client page for client-specific tests
  clientPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const { username, password } = TEST_USERS.client;
    await loginUser(page, username, password);

    await use(page);
    await context.close();
  },

  // Authenticated context (for tests that need multiple pages)
  authenticatedContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const { username, password } = TEST_USERS.admin;
    await loginUser(page, username, password);

    // Store state for the context
    await context.storageState({ path: '.playwright/.auth/admin.json' });

    await use(context);
    await context.close();
  },
});

export { expect };
