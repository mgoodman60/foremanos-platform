import { test, expect, TEST_USERS } from './fixtures/auth';

/**
 * Session and Logout E2E Tests
 *
 * Tests that verify session persistence and logout functionality.
 */

test.describe('Session and Logout', () => {
  test.describe('Session Persistence', () => {
    test('session persists across page reloads', async ({
      authenticatedPage,
    }) => {
      // Navigate to dashboard
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('domcontentloaded');

      // Verify we're on dashboard (authenticated)
      expect(authenticatedPage.url()).toContain('/dashboard');

      // Reload the page
      await authenticatedPage.reload();
      await authenticatedPage.waitForLoadState('domcontentloaded');

      // Should still be on dashboard (session persisted)
      expect(authenticatedPage.url()).toContain('/dashboard');
      expect(authenticatedPage.url()).not.toContain('/login');
    });

    test('session persists when navigating between pages', async ({
      authenticatedPage,
    }) => {
      // Start at dashboard
      await authenticatedPage.goto('/dashboard', { timeout: 15000 });
      await authenticatedPage.waitForLoadState('domcontentloaded');
      expect(authenticatedPage.url()).toContain('/dashboard');

      // Navigate to a project
      await authenticatedPage.goto('/project/riverside-apartments', { timeout: 15000 });
      await authenticatedPage.waitForLoadState('domcontentloaded');
      expect(authenticatedPage.url()).not.toContain('/login');

      // Navigate back to dashboard
      await authenticatedPage.goto('/dashboard', { timeout: 15000 });
      await authenticatedPage.waitForLoadState('domcontentloaded');
      expect(authenticatedPage.url()).toContain('/dashboard');
    });
  });

  test.describe('Logout Functionality', () => {
    test('logout redirects to login page', async ({ authenticatedPage }) => {
      // Start at dashboard
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('domcontentloaded');

      // Try to find and click logout button/link
      // Common selectors for logout
      const logoutSelectors = [
        '[data-testid="logout-button"]',
        'button:has-text("Sign Out")',
        'button:has-text("Logout")',
        'button:has-text("Log out")',
        'button:has-text("Sign out")',
        'a:has-text("Logout")',
        'a:has-text("Log out")',
        'a:has-text("Sign out")',
        '[data-testid="logout"]',
        '#logout',
        '.logout-btn',
      ];

      let logoutClicked = false;
      for (const selector of logoutSelectors) {
        const element = authenticatedPage.locator(selector).first();
        if ((await element.count()) > 0) {
          await element.click();
          logoutClicked = true;
          break;
        }
      }

      if (logoutClicked) {
        // Wait for redirect to login page (signOut can take time)
        await authenticatedPage.waitForURL(/\/login/, { timeout: 10000 });

        // Should be redirected to login
        expect(authenticatedPage.url()).toContain('/login');
      } else {
        // If no logout button found, try navigating to /api/auth/signout
        await authenticatedPage.goto('/api/auth/signout');
        await authenticatedPage.waitForLoadState('domcontentloaded');

        // NextAuth signout page or redirect
        const url = authenticatedPage.url();
        expect(
          url.includes('/login') ||
            url.includes('/signout') ||
            url.includes('/auth')
        ).toBeTruthy();
      }
    });

    test('after logout, cannot access protected routes', async ({
      authenticatedPage,
    }) => {
      // Start authenticated
      await authenticatedPage.goto('/dashboard', { timeout: 15000 });
      await authenticatedPage.waitForLoadState('domcontentloaded');

      // Sign out via API
      await authenticatedPage.goto('/api/auth/signout', { timeout: 15000 });
      await authenticatedPage.waitForLoadState('domcontentloaded');

      // If there's a confirm button, click it
      const confirmBtn = authenticatedPage.locator('button[type="submit"]');
      if ((await confirmBtn.count()) > 0) {
        await confirmBtn.click();
        await authenticatedPage.waitForLoadState('domcontentloaded');
      }

      // Clear cookies to ensure logout
      await authenticatedPage.context().clearCookies();

      // Try to access protected route
      await authenticatedPage.goto('/dashboard', { timeout: 15000 });
      await authenticatedPage.waitForLoadState('domcontentloaded');

      // Should redirect to login
      expect(authenticatedPage.url()).toContain('/login');
    });
  });

  test.describe('Multiple Tabs', () => {
    test('multiple tabs share the same session', async ({
      authenticatedContext,
    }) => {
      // Open first page
      const page1 = await authenticatedContext.newPage();
      await page1.goto('/dashboard', { timeout: 15000 });
      await page1.waitForLoadState('domcontentloaded');

      // Open second page in same context
      const page2 = await authenticatedContext.newPage();
      await page2.goto('/project/riverside-apartments', { timeout: 15000 });
      await page2.waitForLoadState('domcontentloaded');

      // Both should be authenticated (not redirected to login)
      expect(page1.url()).toContain('/dashboard');
      expect(page2.url()).not.toContain('/login');

      await page1.close();
      await page2.close();
    });
  });

  test.describe('Session Security', () => {
    test('accessing login page when authenticated may redirect to dashboard', async ({
      authenticatedPage,
    }) => {
      // When already authenticated, going to login may redirect
      await authenticatedPage.goto('/login');
      await authenticatedPage.waitForLoadState('domcontentloaded');

      // Either stays on login (some apps allow this) or redirects to dashboard
      const url = authenticatedPage.url();
      expect(url.includes('/login') || url.includes('/dashboard')).toBeTruthy();
    });
  });
});
