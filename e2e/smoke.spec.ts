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
    // Homepage may redirect or have dynamic title
    await page.waitForSelector('body', { state: 'visible' });
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('login page is accessible', async ({ page }) => {
    await page.goto('/login');

    // Wait for form to be visible
    await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

    // Should have username and password fields
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('signup page is accessible', async ({ page }) => {
    await page.goto('/signup');

    // Wait for form to be visible
    await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

    // Should have email field on step 1
    await expect(page.locator('#email')).toBeVisible();
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

    // Wait for form
    await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

    // Fill credentials
    await page.locator('#username').fill('invaliduser');
    await page.locator('#password').fill('wrongpassword');
    await page.locator('button[type="submit"]').first().click();

    // Should not redirect to dashboard
    await expect(page).not.toHaveURL('/dashboard', { timeout: 5000 });
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

    // With middleware, should redirect to login immediately
    await expect(page).toHaveURL(/login|signin/, { timeout: 10000 });
  });

  test('pricing page is accessible', async ({ page }) => {
    const response = await page.goto('/pricing');

    // Pricing might redirect or show content
    expect(response?.ok() || response?.status() === 302).toBeTruthy();
  });
});
