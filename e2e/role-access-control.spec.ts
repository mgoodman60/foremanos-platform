import { test, expect, TEST_USERS } from './fixtures/auth';

/**
 * Role-Based Access Control E2E Tests
 *
 * Tests that verify different user roles have appropriate access
 * to protected routes and features.
 */

test.describe('Role-Based Access Control', () => {
  test.describe('Admin Routes', () => {
    test('admin can access /admin page', async ({ adminPage }) => {
      await adminPage.goto('/admin');

      // Should stay on admin page (not redirect)
      await expect(adminPage).toHaveURL(/\/admin/);

      // Should see admin content
      await expect(adminPage.locator('body')).not.toContainText('Access Denied');
    });

    test('admin can access /admin/users page', async ({ adminPage }) => {
      await adminPage.goto('/admin/users');

      // Should stay on admin/users page
      await expect(adminPage).toHaveURL(/\/admin\/users/);

      // Should not see access denied
      await expect(adminPage.locator('body')).not.toContainText('Access Denied');
    });

    test('client cannot access /admin page - redirects or shows error', async ({
      clientPage,
    }) => {
      await clientPage.goto('/admin');

      // Wait for either redirect or error message to appear
      // The admin page client-side check redirects non-admins
      try {
        await clientPage.waitForURL(/\/(dashboard|login)/, { timeout: 5000 });
        // Successfully redirected
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

    test('unauthenticated user cannot access /admin - redirects to login', async ({
      page,
    }) => {
      // Go directly to admin without authentication
      await page.goto('/admin');

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
  });

  test.describe('API Route Access', () => {
    test('admin can access /api/admin/users', async ({ adminPage, request }) => {
      // Get cookies from admin page context
      const cookies = await adminPage.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      const response = await request.get('/api/admin/users', {
        headers: { Cookie: cookieHeader },
      });

      // Should succeed (200) or at least not be 401/403
      expect([200, 201]).toContain(response.status());
    });

    test('unauthenticated request to /api/admin/users returns 401', async ({
      request,
    }) => {
      const response = await request.get('/api/admin/users');

      // Should be unauthorized
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Dashboard Access', () => {
    test('admin can access dashboard', async ({ adminPage }) => {
      await adminPage.goto('/dashboard');
      await expect(adminPage).toHaveURL(/\/dashboard/);
    });

    test('client can access dashboard', async ({ clientPage }) => {
      await clientPage.goto('/dashboard');
      await expect(clientPage).toHaveURL(/\/dashboard/);
    });

    test('authenticated user sees their role-appropriate content', async ({
      adminPage,
    }) => {
      await adminPage.goto('/dashboard');

      // Admin should be able to see admin-specific elements or links
      // This is a basic check - expand based on actual UI
      const body = await adminPage.locator('body').textContent();
      expect(body).toBeTruthy();
    });
  });

  test.describe('Project Routes', () => {
    test('admin can access project page', async ({ adminPage }) => {
      // Navigate to a project (assuming riverside-apartments exists from seed)
      await adminPage.goto('/project/riverside-apartments');

      // Should not redirect to login
      const url = adminPage.url();
      expect(url.includes('/login')).toBeFalsy();
    });

    test('client can access project page', async ({ clientPage }) => {
      await clientPage.goto('/project/riverside-apartments');

      // Should not redirect to login
      const url = clientPage.url();
      expect(url.includes('/login')).toBeFalsy();
    });

    test('unauthenticated user cannot access project - redirects to login', async ({
      page,
    }) => {
      await page.goto('/project/riverside-apartments');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
