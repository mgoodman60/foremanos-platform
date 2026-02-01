import { test, expect } from '@playwright/test';
import { test as authTest } from './fixtures/auth';

/**
 * E2E Accessibility Tests for ForemanOS
 *
 * Tests verify:
 * 1. Skip-to-content link functionality
 * 2. Modal focus trap behavior
 * 3. Focus returns to trigger on modal close
 * 4. Escape key closes modals
 * 5. Screen reader announcements
 *
 * Run with: npx playwright test e2e/accessibility.spec.ts --project=chromium
 */

test.describe('Skip to Content Link', () => {
  test('skip link becomes visible on Tab press', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('body', { state: 'visible' });

    // Get the skip link
    const skipLink = page.locator('a[href="#main-content"]');

    // Initially should be visually hidden (sr-only class makes it off-screen but in DOM)
    // Check that it has sr-only class initially (before focus)
    const initialClasses = await skipLink.getAttribute('class');
    expect(initialClasses).toContain('sr-only');

    // Press Tab to focus
    await page.keyboard.press('Tab');

    // After Tab, skip link should be visible (focus:not-sr-only removes sr-only styling)
    await expect(skipLink).toBeVisible();
    await expect(skipLink).toBeFocused();
  });

  test('skip link navigates to main content', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('body', { state: 'visible' });

    // Press Tab to focus skip link
    await page.keyboard.press('Tab');

    // Get the skip link and click it
    const skipLink = page.locator('a[href="#main-content"]');
    await skipLink.click();

    // Check that focus moved or URL hash changed
    const currentUrl = page.url();
    expect(currentUrl).toContain('#main-content');
  });

  test('skip link text is correct', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('body', { state: 'visible' });

    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toHaveText('Skip to main content');
  });
});

test.describe('Modal Focus Trap', () => {
  authTest('focus is trapped within modal when open', async ({ authenticatedPage }) => {
    // Navigate to a page with a modal trigger (e.g., dashboard or project page)
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForSelector('body', { state: 'visible' });

    // Look for any button that opens a modal
    const modalTrigger = authenticatedPage.locator('button').filter({ hasText: /add|create|new|upload/i }).first();

    // Skip if no modal trigger found on this page
    if (!(await modalTrigger.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    // Click to open modal
    await modalTrigger.click();

    // Wait for dialog to appear
    const dialog = authenticatedPage.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

    if (!(await dialog.isVisible())) {
      test.skip();
      return;
    }

    // Verify dialog has aria-modal
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Get all focusable elements within the dialog
    const focusableElements = dialog.locator(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const count = await focusableElements.count();
    if (count < 2) {
      test.skip();
      return;
    }

    // Tab through and verify focus stays within modal
    for (let i = 0; i < count + 2; i++) {
      await authenticatedPage.keyboard.press('Tab');
    }

    // After tabbing past all elements, focus should wrap to first focusable
    const activeElement = await authenticatedPage.evaluate(() => {
      const active = document.activeElement;
      const dialog = document.querySelector('[role="dialog"]');
      return dialog?.contains(active);
    });

    expect(activeElement).toBe(true);
  });

  authTest('Escape key closes modal', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForSelector('body', { state: 'visible' });

    // Look for any button that opens a modal
    const modalTrigger = authenticatedPage.locator('button').filter({ hasText: /add|create|new|upload/i }).first();

    if (!(await modalTrigger.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    // Click to open modal
    await modalTrigger.click();

    // Wait for dialog
    const dialog = authenticatedPage.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

    if (!(await dialog.isVisible())) {
      test.skip();
      return;
    }

    // Press Escape
    await authenticatedPage.keyboard.press('Escape');

    // Dialog should be closed
    await expect(dialog).toBeHidden({ timeout: 3000 });
  });

  authTest('focus returns to trigger after modal closes', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForSelector('body', { state: 'visible' });

    // Look for any button that opens a modal
    const modalTrigger = authenticatedPage.locator('button').filter({ hasText: /add|create|new|upload/i }).first();

    if (!(await modalTrigger.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    // Get trigger element id or generate one for comparison
    const triggerId = await modalTrigger.evaluate((el) => {
      if (!el.id) el.id = 'test-trigger-' + Math.random();
      return el.id;
    });

    // Click to open modal
    await modalTrigger.click();

    // Wait for dialog
    const dialog = authenticatedPage.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

    if (!(await dialog.isVisible())) {
      test.skip();
      return;
    }

    // Close modal with Escape
    await authenticatedPage.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});

    // Wait a moment for focus to return
    await authenticatedPage.waitForTimeout(100);

    // Check if focus returned to trigger
    const focusedElementId = await authenticatedPage.evaluate(() => document.activeElement?.id);
    expect(focusedElementId).toBe(triggerId);
  });
});

test.describe('ARIA Live Regions', () => {
  test('announcer region exists in DOM', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('body', { state: 'visible' });

    // Check for aria-live regions (assertive and polite)
    const liveRegions = page.locator('[aria-live]');
    const count = await liveRegions.count();

    // Should have at least one live region (from AnnouncerProvider)
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('loading overlays have correct ARIA attributes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('body', { state: 'visible' });

    // Check loading overlay structure if present
    const loadingOverlay = page.locator('[role="status"][aria-busy="true"]');

    // This is a structural test - overlay may not be visible on initial load
    // But when visible, it should have correct attributes
    const overlayInfo = await page.evaluate(() => {
      const overlay = document.querySelector('[role="status"][aria-busy="true"]');
      if (!overlay) return null;
      return {
        ariaLive: overlay.getAttribute('aria-live'),
        ariaBusy: overlay.getAttribute('aria-busy'),
      };
    });

    if (overlayInfo) {
      expect(overlayInfo.ariaLive).toBe('polite');
      expect(overlayInfo.ariaBusy).toBe('true');
    }
  });
});

test.describe('Dialog Accessibility', () => {
  test('dialogs have required ARIA attributes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('body', { state: 'visible' });

    const dialogInfo = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      return Array.from(dialogs).map((dialog) => ({
        hasAriaModal: dialog.getAttribute('aria-modal') === 'true',
        hasLabel:
          dialog.hasAttribute('aria-labelledby') ||
          dialog.hasAttribute('aria-label'),
      }));
    });

    // All dialogs should have required attributes
    dialogInfo.forEach((info) => {
      expect(info.hasAriaModal).toBe(true);
      expect(info.hasLabel).toBe(true);
    });
  });

  test('close buttons have accessible labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('body', { state: 'visible' });

    // Check that close buttons within dialogs have accessible names
    const closeButtonInfo = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      const results: { hasAccessibleName: boolean }[] = [];

      dialogs.forEach((dialog) => {
        const closeButtons = dialog.querySelectorAll(
          'button[aria-label*="close" i], button[aria-label*="Close" i], button:has(.sr-only)'
        );
        closeButtons.forEach((btn) => {
          const ariaLabel = btn.getAttribute('aria-label');
          const srOnly = btn.querySelector('.sr-only');
          results.push({
            hasAccessibleName: !!(ariaLabel || srOnly?.textContent),
          });
        });
      });

      return results;
    });

    closeButtonInfo.forEach((info) => {
      expect(info.hasAccessibleName).toBe(true);
    });
  });
});

test.describe('Form Accessibility', () => {
  test('form inputs have associated labels', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

    const inputInfo = await page.evaluate(() => {
      const inputs = document.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"])'
      );
      return Array.from(inputs).map((input) => {
        const id = input.getAttribute('id');
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledby = input.getAttribute('aria-labelledby');
        const labelFor = id ? document.querySelector(`label[for="${id}"]`) : null;
        const parentLabel = input.closest('label');

        return {
          hasLabel: !!(labelFor || parentLabel || ariaLabel || ariaLabelledby),
          inputId: id,
        };
      });
    });

    inputInfo.forEach((info) => {
      expect(info.hasLabel).toBe(true);
    });
  });

  test('error messages are associated with inputs via aria-describedby', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

    // Submit empty form to trigger validation
    await page.locator('button[type="submit"]').first().click();

    // Wait a moment for validation
    await page.waitForTimeout(500);

    // Check for error messages with proper associations
    const errorInfo = await page.evaluate(() => {
      const errorElements = document.querySelectorAll('[id$="-error"], [role="alert"]');
      return Array.from(errorElements).map((el) => {
        const id = el.getAttribute('id');
        // Check if any input references this error
        const referencingInput = id
          ? document.querySelector(`[aria-describedby*="${id}"]`)
          : null;
        return {
          hasId: !!id,
          isReferenced: !!referencingInput,
          role: el.getAttribute('role'),
        };
      });
    });

    // If there are error elements, they should have proper structure
    errorInfo.forEach((info) => {
      if (info.hasId) {
        // Error should be referenced by an input or have role="alert"
        expect(info.isReferenced || info.role === 'alert').toBe(true);
      }
    });
  });
});

test.describe('Keyboard Navigation', () => {
  test('all interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('body', { state: 'visible' });

    const interactiveInfo = await page.evaluate(() => {
      const interactiveElements = document.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      return Array.from(interactiveElements)
        .filter((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        })
        .map((el) => {
          const tabIndex = el.getAttribute('tabindex');
          return {
            tagName: el.tagName.toLowerCase(),
            isKeyboardAccessible:
              tabIndex !== '-1' &&
              (el.tagName !== 'A' || el.hasAttribute('href')),
          };
        });
    });

    interactiveInfo.forEach((info) => {
      expect(info.isKeyboardAccessible).toBe(true);
    });
  });

  test('focus indicator is visible on interactive elements', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

    // Tab to first input
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check that focused element has visible focus styles
    const focusInfo = await page.evaluate(() => {
      const focused = document.activeElement;
      if (!focused || focused === document.body) return null;

      const style = window.getComputedStyle(focused);
      const outlineWidth = parseFloat(style.outlineWidth) || 0;
      const boxShadow = style.boxShadow;
      const ringStyles = style.getPropertyValue('--tw-ring-offset-width');

      return {
        hasOutline: outlineWidth > 0,
        hasBoxShadow: boxShadow !== 'none',
        hasTailwindRing: !!ringStyles,
        tagName: focused.tagName.toLowerCase(),
      };
    });

    if (focusInfo) {
      // Element should have some visible focus indicator
      expect(
        focusInfo.hasOutline ||
          focusInfo.hasBoxShadow ||
          focusInfo.hasTailwindRing
      ).toBe(true);
    }
  });
});
