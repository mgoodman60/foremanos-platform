import { test, expect, TEST_USERS } from './fixtures/auth';

/**
 * Security Middleware E2E Tests
 *
 * Tests that verify middleware properly protects routes
 * including newly added /project/:path*, /admin/:path*, and /profile/:path*
 */

test.describe('Security Middleware Protection', () => {
  test.describe('Unauthenticated Access', () => {
    test('unauthenticated user cannot access /project routes - redirects to login', async ({
      page,
    }) => {
      await page.goto('/project/riverside-apartments');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test('unauthenticated user cannot access /projects routes - redirects to login', async ({
      page,
    }) => {
      await page.goto('/projects');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test('unauthenticated user cannot access /admin routes - redirects to login', async ({
      page,
    }) => {
      await page.goto('/admin');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test('unauthenticated user cannot access /admin/users - redirects to login', async ({
      page,
    }) => {
      await page.goto('/admin/users');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test('unauthenticated user cannot access /profile routes - redirects to login', async ({
      page,
    }) => {
      await page.goto('/profile');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test('unauthenticated user cannot access /dashboard - redirects to login', async ({
      page,
    }) => {
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test('unauthenticated user cannot access /settings - redirects to login', async ({
      page,
    }) => {
      await page.goto('/settings');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test('unauthenticated user cannot access /chat - redirects to login', async ({
      page,
    }) => {
      await page.goto('/chat');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Client Role Access', () => {
    test('client can access their own project', async ({ clientPage }) => {
      // Navigate to a project (clients should have project access)
      await clientPage.goto('/projects');

      // Should stay on projects page
      await expect(clientPage).toHaveURL(/\/projects/);

      // Should see projects content
      await expect(clientPage.locator('body')).not.toContainText('Access Denied');
    });

    test('client cannot access admin routes', async ({ clientPage }) => {
      await clientPage.goto('/admin');

      // Should redirect away from admin or show access denied
      try {
        await clientPage.waitForURL(/\/(dashboard|login)/, { timeout: 5000 });
        const currentUrl = clientPage.url();
        expect(
          currentUrl.includes('/dashboard') || currentUrl.includes('/login')
        ).toBeTruthy();
      } catch {
        // Didn't redirect - check for error message
        await clientPage.waitForLoadState('networkidle');
        const bodyText = await clientPage.locator('body').textContent();
        expect(
          bodyText?.toLowerCase().includes('access denied') ||
            bodyText?.toLowerCase().includes('unauthorized') ||
            bodyText?.toLowerCase().includes('forbidden')
        ).toBeTruthy();
      }
    });

    test('client can access dashboard', async ({ clientPage }) => {
      await clientPage.goto('/dashboard');

      // Should stay on dashboard
      await expect(clientPage).toHaveURL(/\/dashboard/);
    });

    test('client can access chat', async ({ clientPage }) => {
      await clientPage.goto('/chat');

      // Should stay on chat (not redirect to login)
      await expect(clientPage).not.toHaveURL(/\/login/);
    });
  });

  test.describe('Admin Role Access', () => {
    test('admin can access /admin routes', async ({ adminPage }) => {
      await adminPage.goto('/admin');

      // Should stay on admin page
      await expect(adminPage).toHaveURL(/\/admin/);

      // Should not see access denied
      await expect(adminPage.locator('body')).not.toContainText('Access Denied');
    });

    test('admin can access /admin/users', async ({ adminPage }) => {
      await adminPage.goto('/admin/users');

      // Should stay on admin/users page
      await expect(adminPage).toHaveURL(/\/admin\/users/);
    });

    test('admin can access projects', async ({ adminPage }) => {
      await adminPage.goto('/projects');

      // Should stay on projects page
      await expect(adminPage).toHaveURL(/\/projects/);
    });

    test('admin can access dashboard', async ({ adminPage }) => {
      await adminPage.goto('/dashboard');

      // Should stay on dashboard
      await expect(adminPage).toHaveURL(/\/dashboard/);
    });
  });

  test.describe('Maintenance API Protection', () => {
    test('unauthenticated POST to maintenance API returns 403', async ({ page }) => {
      const response = await page.request.post('/api/maintenance', {
        data: { isActive: true },
      });

      // Should return 403 Forbidden (admin required)
      expect(response.status()).toBe(403);
    });

    test('GET maintenance status is publicly accessible', async ({ page }) => {
      const response = await page.request.get('/api/maintenance');

      // GET should work (public endpoint to check maintenance status)
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty('isActive');
    });

    test('non-admin POST to maintenance API returns 403', async ({ clientPage }) => {
      const response = await clientPage.request.post('/api/maintenance', {
        data: { isActive: true },
      });

      // Should return 403 Forbidden (admin required)
      expect(response.status()).toBe(403);
    });
  });
});
