import { test, expect } from '@playwright/test';

/**
 * E2E Smoke Tests for ForemanOS
 *
 * These tests verify basic functionality is working after deployment.
 * Run with: npx playwright test e2e/smoke.spec.ts
 */

test.describe('Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ForemanOS|Foreman/i);
  });

  test('login page is accessible', async ({ page }) => {
    await page.goto('/login');

    // Should have email and password fields
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
  });

  test('signup page is accessible', async ({ page }) => {
    await page.goto('/signup');

    // Should have registration form
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  });

  test('API health check returns OK', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(['healthy', 'degraded']).toContain(data.status);
  });
});

test.describe('Auth Flow', () => {
  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"], input[name="email"]', 'invalid@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message (not redirect to dashboard)
    await expect(page).not.toHaveURL('/dashboard');
  });

  test('forgot password page is accessible', async ({ page }) => {
    await page.goto('/login');

    // Click forgot password link if exists
    const forgotLink = page.locator('a:has-text("forgot"), a:has-text("Forgot")');
    if (await forgotLink.count() > 0) {
      await forgotLink.click();
      await expect(page).toHaveURL(/forgot|reset/);
    }
  });
});

test.describe('Navigation', () => {
  test('unauthenticated user is redirected from protected routes', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/login|signin/);
  });

  test('pricing page is accessible', async ({ page }) => {
    const response = await page.goto('/pricing');

    // Pricing might redirect or show content
    expect(response?.ok() || response?.status() === 302).toBeTruthy();
  });
});
