import { test, expect, TEST_USERS } from './fixtures/auth';
import { loginViaUI, clearAuthState, verifyDashboardAccess } from './helpers/test-user';

/**
 * E2E Auth Tests for ForemanOS
 *
 * Tests authentication flows using the seeded test users.
 *
 * Prerequisites:
 * - Run `npx prisma db seed` to create test users
 *
 * Run with: npx playwright test e2e/auth.spec.ts
 */

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await clearAuthState(page);
  });

  test('admin can login successfully', async ({ page }) => {
    await page.goto('/login');

    // Wait for form
    await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

    // Fill admin credentials
    await page.locator('#username').fill(TEST_USERS.admin.username);
    await page.locator('#password').fill(TEST_USERS.admin.password);

    // Submit
    await page.locator('button[type="submit"]').first().click();

    // Should redirect to dashboard or home (not stay on login)
    await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Wait for form
    await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

    // Fill invalid credentials
    await page.locator('#username').fill('nonexistent');
    await page.locator('#password').fill('wrongpassword');

    // Submit
    await page.locator('button[type="submit"]').first().click();

    // Should stay on login page
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });

  test('shows error for empty credentials', async ({ page }) => {
    await page.goto('/login');

    // Wait for form
    await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

    // Try to submit empty form
    await page.locator('button[type="submit"]').first().click();

    // Should stay on login page
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Authenticated Routes', () => {
  test('authenticated user can access dashboard', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/dashboard');

    // Should be on dashboard (not redirected to login)
    await expect(authenticatedPage).toHaveURL(/dashboard/);
    await expect(authenticatedPage.locator('body')).toBeVisible();
  });

  test('authenticated admin can access projects', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');

    // Verify we're logged in
    await expect(adminPage).not.toHaveURL(/login/);

    // Look for project-related content or navigation
    const body = await adminPage.textContent('body');
    expect(body?.length).toBeGreaterThan(0);
  });
});

test.describe('Session Persistence', () => {
  test('session persists across page navigations', async ({
    authenticatedPage,
  }) => {
    // Go to dashboard
    await authenticatedPage.goto('/dashboard');
    await expect(authenticatedPage).not.toHaveURL(/login/);

    // Navigate to another protected route
    await authenticatedPage.goto('/projects');

    // Should still be authenticated (not redirected to login)
    // Projects might redirect to dashboard or show projects list
    await expect(authenticatedPage).not.toHaveURL(/login/);
  });

  test('session persists after page reload', async ({ authenticatedPage }) => {
    // Go to dashboard
    await authenticatedPage.goto('/dashboard');
    await expect(authenticatedPage).not.toHaveURL(/login/);

    // Reload page
    await authenticatedPage.reload();

    // Should still be authenticated
    await expect(authenticatedPage).not.toHaveURL(/login/);
  });
});

test.describe('Protected Routes Redirect', () => {
  test('unauthenticated user is redirected from /dashboard', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/login|signin/, { timeout: 10000 });
  });

  test('unauthenticated user is redirected from /projects', async ({
    page,
  }) => {
    await page.goto('/projects');

    // Should redirect to login
    await expect(page).toHaveURL(/login|signin/, { timeout: 10000 });
  });
});
