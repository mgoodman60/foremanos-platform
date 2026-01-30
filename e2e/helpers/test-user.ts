import { Page, expect } from '@playwright/test';

/**
 * Test User Helper for ForemanOS E2E Tests
 *
 * Provides utility functions for user operations in tests.
 */

export interface TestUserCredentials {
  username: string;
  password: string;
  email?: string;
}

/**
 * Login a user via the UI
 */
export async function loginViaUI(
  page: Page,
  credentials: TestUserCredentials
): Promise<void> {
  await page.goto('/login');

  // Wait for form
  await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

  // Fill credentials
  await page.locator('#username').fill(credentials.username);
  await page.locator('#password').fill(credentials.password);

  // Submit
  await page.locator('button[type="submit"]').first().click();

  // Wait for redirect
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 10000,
  });
}

/**
 * Logout a user via the UI
 */
export async function logoutViaUI(page: Page): Promise<void> {
  // Look for logout button/link in common locations
  const logoutSelectors = [
    'button:has-text("Logout")',
    'button:has-text("Log out")',
    'button:has-text("Sign out")',
    'a:has-text("Logout")',
    'a:has-text("Log out")',
    'a:has-text("Sign out")',
    '[data-testid="logout-button"]',
  ];

  for (const selector of logoutSelectors) {
    const element = page.locator(selector);
    if ((await element.count()) > 0) {
      await element.first().click();
      break;
    }
  }

  // Wait for redirect to login or home
  await page.waitForURL((url) =>
    ['/login', '/signin', '/'].includes(url.pathname)
  );
}

/**
 * Check if user is currently logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  // Try to access a protected route
  const currentUrl = page.url();
  await page.goto('/dashboard');

  // If we stay on dashboard, we're logged in
  const dashboardUrl = page.url();
  const loggedIn =
    dashboardUrl.includes('/dashboard') && !dashboardUrl.includes('/login');

  // Go back to original page
  await page.goto(currentUrl);

  return loggedIn;
}

/**
 * Verify user is on the expected page after login
 */
export async function verifyDashboardAccess(page: Page): Promise<void> {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator('body')).toBeVisible();
}

/**
 * Get stored auth token from cookies (if using cookie-based auth)
 */
export async function getAuthCookies(
  page: Page
): Promise<{ name: string; value: string }[]> {
  const context = page.context();
  const cookies = await context.cookies();

  // Filter for auth-related cookies
  return cookies.filter(
    (cookie) =>
      cookie.name.includes('auth') ||
      cookie.name.includes('session') ||
      cookie.name.includes('next-auth')
  );
}

/**
 * Clear auth state (for testing login flows)
 */
export async function clearAuthState(page: Page): Promise<void> {
  const context = page.context();
  await context.clearCookies();

  // Also clear localStorage if needed
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}
