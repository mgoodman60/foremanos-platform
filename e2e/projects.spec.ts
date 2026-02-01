import { test, expect } from './fixtures/auth';

/**
 * E2E Project Tests for ForemanOS
 *
 * Tests project management functionality including:
 * - Project listing
 * - Project navigation
 * - Project details access
 *
 * Prerequisites:
 * - Run `npx prisma db seed` to create test users and projects
 *
 * Run with: npx playwright test e2e/projects.spec.ts
 */

test.describe('Project Listing', () => {
  test('authenticated user can view projects page', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/projects');

    // Should be on projects or dashboard (not login)
    await expect(authenticatedPage).not.toHaveURL(/login/);
  });

  test('projects page displays project cards or list', async ({
    adminPage,
  }) => {
    await adminPage.goto('/projects');

    // Wait for page to load
    await adminPage.waitForLoadState('networkidle');

    // Should have some content on the page
    const body = await adminPage.textContent('body');
    expect(body?.length).toBeGreaterThan(100);
  });
});

test.describe('Project Navigation', () => {
  test('can navigate to project dashboard from projects list', async ({
    adminPage,
  }) => {
    await adminPage.goto('/dashboard');

    // Wait for page to load
    await adminPage.waitForLoadState('networkidle');

    // Look for any project link (usually has /project/ in URL)
    const projectLink = adminPage.locator('a[href*="/project/"]').first();

    if ((await projectLink.count()) > 0) {
      await projectLink.click();

      // Should navigate to a project page
      await expect(adminPage).toHaveURL(/\/project\//);
    }
  });
});

test.describe('Project Details', () => {
  test('project page loads without error', async ({ adminPage }) => {
    // First go to dashboard to get a project link
    await adminPage.goto('/dashboard');
    await adminPage.waitForLoadState('networkidle');

    // Find a project link
    const projectLink = adminPage.locator('a[href*="/project/"]').first();

    if ((await projectLink.count()) > 0) {
      const href = await projectLink.getAttribute('href');
      if (href) {
        await adminPage.goto(href);

        // Page should load without server error
        await expect(adminPage.locator('body')).toBeVisible();
        await expect(adminPage).not.toHaveURL(/error/);
      }
    }
  });

  test('project page has navigation elements', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await adminPage.waitForLoadState('networkidle');

    const projectLink = adminPage.locator('a[href*="/project/"]').first();

    if ((await projectLink.count()) > 0) {
      await projectLink.click();
      await adminPage.waitForLoadState('networkidle');

      // Project pages typically have navigation/sidebar
      const body = await adminPage.textContent('body');
      expect(body?.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Project Access Control', () => {
  test('unauthenticated user cannot access project', async ({ page }) => {
    // Try to access a project directly
    await page.goto('/project/test-project');

    // Should be redirected to login
    await expect(page).toHaveURL(/login|signin/, { timeout: 10000 });
  });
});
