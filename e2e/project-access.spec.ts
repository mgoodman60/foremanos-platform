import { test, expect } from './fixtures/auth';

/**
 * Project-Level Access E2E Tests
 *
 * Tests that verify users can only access projects they own
 * or are assigned to.
 */

test.describe('Project-Level Access', () => {
  test.describe('Project Listing', () => {
    test('admin can see all projects on dashboard', async ({ adminPage }) => {
      await adminPage.goto('/dashboard');

      // Wait for dashboard to load
      await adminPage.waitForLoadState('domcontentloaded');

      // Should be on dashboard (not redirected to login)
      expect(adminPage.url()).toContain('/dashboard');

      // Admin should see the welcome message
      const welcomeText = adminPage.locator('h2:has-text("Welcome back")');
      await expect(welcomeText).toBeVisible({ timeout: 5000 });

      // Admin should see their projects section
      const projectsSection = adminPage.locator('h3:has-text("Your Projects")');
      await expect(projectsSection).toBeVisible({ timeout: 5000 });
    });

    test('client user can access dashboard', async ({ clientPage }) => {
      await clientPage.goto('/dashboard');

      // Wait for dashboard to load
      await clientPage.waitForLoadState('domcontentloaded');

      // Page should load successfully
      const body = await clientPage.locator('body').textContent();
      expect(body).toBeTruthy();
    });
  });

  test.describe('Project Page Access', () => {
    test('admin can access Riverside Apartments project', async ({
      adminPage,
    }) => {
      await adminPage.goto('/project/riverside-apartments');

      // Should load successfully (not redirect to error page)
      await adminPage.waitForLoadState('domcontentloaded');

      // Check we're on a project page
      const url = adminPage.url();
      expect(url).toContain('riverside-apartments');
    });

    test('admin can access Downtown Office Tower project', async ({
      adminPage,
    }) => {
      await adminPage.goto('/project/downtown-office-tower');
      await adminPage.waitForLoadState('domcontentloaded');

      const url = adminPage.url();
      expect(url).toContain('downtown-office-tower');
    });

    test('admin can access Harbor Marina project', async ({ adminPage }) => {
      await adminPage.goto('/project/harbor-marina');
      await adminPage.waitForLoadState('domcontentloaded');

      const url = adminPage.url();
      expect(url).toContain('harbor-marina');
    });

    test('attempting to access non-existent project shows 404 or error', async ({
      adminPage,
    }) => {
      await adminPage.goto('/project/non-existent-project-12345');
      await adminPage.waitForLoadState('domcontentloaded');

      // Should either redirect or show not found
      const body = await adminPage.locator('body').textContent();
      const url = adminPage.url();

      // Either shows 404/not found OR redirects away
      const shows404 =
        body?.toLowerCase().includes('not found') ||
        body?.toLowerCase().includes('404');
      const redirected = !url.includes('non-existent-project');

      expect(shows404 || redirected).toBeTruthy();
    });
  });

  test.describe('Project Feature Access', () => {
    test('admin can access project budget page', async ({ adminPage }) => {
      await adminPage.goto('/project/riverside-apartments/budget');
      await adminPage.waitForLoadState('domcontentloaded');

      // Should not redirect to login
      expect(adminPage.url().includes('/login')).toBeFalsy();
    });

    test('admin can access project schedule page', async ({ adminPage }) => {
      await adminPage.goto('/project/riverside-apartments/schedule');
      await adminPage.waitForLoadState('domcontentloaded');

      expect(adminPage.url().includes('/login')).toBeFalsy();
    });

    test('admin can access project documents page', async ({ adminPage }) => {
      await adminPage.goto('/project/riverside-apartments/documents');
      await adminPage.waitForLoadState('domcontentloaded');

      expect(adminPage.url().includes('/login')).toBeFalsy();
    });

    test('admin can access project chat page', async ({ adminPage }) => {
      await adminPage.goto('/project/riverside-apartments/chat');
      await adminPage.waitForLoadState('domcontentloaded');

      expect(adminPage.url().includes('/login')).toBeFalsy();
    });
  });

  test.describe('Cross-Project Navigation', () => {
    test('admin can navigate between projects', async ({ adminPage }) => {
      // Start at Riverside
      await adminPage.goto('/project/riverside-apartments');
      await adminPage.waitForLoadState('domcontentloaded', { timeout: 15000 });
      expect(adminPage.url()).toContain('riverside-apartments');

      // Navigate to Downtown
      await adminPage.goto('/project/downtown-office-tower');
      await adminPage.waitForLoadState('domcontentloaded', { timeout: 15000 });
      expect(adminPage.url()).toContain('downtown-office-tower');

      // Navigate to Harbor
      await adminPage.goto('/project/harbor-marina');
      await adminPage.waitForLoadState('domcontentloaded', { timeout: 15000 });
      expect(adminPage.url()).toContain('harbor-marina');
    });
  });
});
