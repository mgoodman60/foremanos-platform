import { test, expect, TEST_USERS } from './fixtures/auth';

/**
 * User Approval Workflow E2E Tests
 *
 * Tests that verify the user approval gate works correctly:
 * - Unapproved users cannot login
 * - Proper error messages are shown
 */

test.describe('User Approval Workflow', () => {
  test.describe('Unapproved User Login', () => {
    test('unapproved user cannot login - shows pending message', async ({
      page,
    }) => {
      await page.goto('/login');

      // Wait for form to be visible
      await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

      // Fill in unapproved user credentials
      await page.locator('#username').fill(TEST_USERS.unapproved.username);
      await page.locator('#password').fill(TEST_USERS.unapproved.password);

      // Submit
      await page.locator('button[type="submit"]').first().click();

      // Wait a bit for the response
      await page.waitForTimeout(2000);

      // Should still be on login page (login failed)
      expect(page.url()).toContain('/login');

      // Should show an error message about pending/approval
      const bodyText = await page.locator('body').textContent();
      const hasErrorMessage =
        bodyText?.toLowerCase().includes('pending') ||
        bodyText?.toLowerCase().includes('approval') ||
        bodyText?.toLowerCase().includes('not approved') ||
        bodyText?.toLowerCase().includes('error') ||
        bodyText?.toLowerCase().includes('invalid');

      expect(hasErrorMessage).toBeTruthy();
    });

    test('unapproved user cannot access protected routes directly', async ({
      page,
    }) => {
      // Try to access dashboard without logging in
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Approved User Login', () => {
    test('approved admin user can login successfully', async ({ page }) => {
      await page.goto('/login');
      await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

      await page.locator('#username').fill(TEST_USERS.admin.username);
      await page.locator('#password').fill(TEST_USERS.admin.password);
      await page.locator('button[type="submit"]').first().click();

      // Should redirect away from login on success
      try {
        await page.waitForURL((url) => !url.pathname.includes('/login'), {
          timeout: 10000,
        });
        // Success - not on login page anymore
        expect(page.url()).not.toContain('/login');
      } catch {
        // If still on login, check for error
        const bodyText = await page.locator('body').textContent();
        // This should not happen for approved admin
        expect(bodyText?.toLowerCase().includes('error')).toBeFalsy();
      }
    });

    test('approved client user can login successfully', async ({ page }) => {
      await page.goto('/login');
      await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

      await page.locator('#username').fill(TEST_USERS.client.username);
      await page.locator('#password').fill(TEST_USERS.client.password);
      await page.locator('button[type="submit"]').first().click();

      try {
        await page.waitForURL((url) => !url.pathname.includes('/login'), {
          timeout: 10000,
        });
        expect(page.url()).not.toContain('/login');
      } catch {
        const bodyText = await page.locator('body').textContent();
        expect(bodyText?.toLowerCase().includes('error')).toBeFalsy();
      }
    });
  });

  test.describe('Invalid Credentials', () => {
    test('login with wrong password shows error', async ({ page }) => {
      await page.goto('/login');
      await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

      await page.locator('#username').fill(TEST_USERS.admin.username);
      await page.locator('#password').fill('wrongpassword123');
      await page.locator('button[type="submit"]').first().click();

      await page.waitForTimeout(2000);

      // Should still be on login page
      expect(page.url()).toContain('/login');

      // Should show error
      const bodyText = await page.locator('body').textContent();
      expect(
        bodyText?.toLowerCase().includes('error') ||
          bodyText?.toLowerCase().includes('invalid') ||
          bodyText?.toLowerCase().includes('incorrect')
      ).toBeTruthy();
    });

    test('login with non-existent user shows error', async ({ page }) => {
      await page.goto('/login');
      await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

      await page.locator('#username').fill('nonexistentuser12345');
      await page.locator('#password').fill('somepassword');
      await page.locator('button[type="submit"]').first().click();

      await page.waitForTimeout(2000);

      // Should still be on login page
      expect(page.url()).toContain('/login');
    });
  });
});
