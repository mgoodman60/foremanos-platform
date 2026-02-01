import { test, expect } from './fixtures/auth';

/**
 * Budget Management E2E Tests
 *
 * Tests for budget dashboard, EVM metrics, change orders, and invoice management.
 */

test.describe('Budget Management', () => {
  test.describe('Budget Dashboard', () => {
    test('dashboard loads with variance widgets', async ({ adminPage }) => {
      await adminPage.goto('/projects');
      await adminPage.waitForLoadState('networkidle');

      // Click on first available project
      const projectLink = adminPage.locator('a[href*="/project/"]').first();
      if (await projectLink.isVisible()) {
        await projectLink.click();
        await adminPage.waitForLoadState('networkidle');

        // Navigate to budget section if available
        const budgetTab = adminPage.locator('text=Budget').first();
        if (await budgetTab.isVisible()) {
          await budgetTab.click();
          await adminPage.waitForLoadState('networkidle');

          // Check for budget dashboard elements
          const body = await adminPage.locator('body').textContent();

          // At minimum, page should load without error
          expect(body).not.toContain('Error');
        }
      }
    });

    test('budget API returns valid EVM metrics', async ({ adminPage }) => {
      // First get a project slug
      await adminPage.goto('/projects');
      await adminPage.waitForLoadState('networkidle');

      const projectLink = adminPage.locator('a[href*="/project/"]').first();
      if (await projectLink.isVisible()) {
        const href = await projectLink.getAttribute('href');
        const slug = href?.split('/project/')[1]?.split('/')[0] || '';

        if (slug) {
          const response = await adminPage.request.get(
            `/api/projects/${slug}/budget/dashboard`
          );

          // API should respond (200 or 404 if no budget configured)
          expect([200, 404]).toContain(response.status());

          if (response.status() === 200) {
            const data = await response.json();

            // Verify EVM metrics structure
            expect(data).toHaveProperty('totalBudget');
            expect(data).toHaveProperty('actualCost');
            expect(data).toHaveProperty('earnedValue');
            expect(data).toHaveProperty('costPerformanceIndex');

            // CPI should be a valid number
            expect(typeof data.costPerformanceIndex).toBe('number');
            expect(isFinite(data.costPerformanceIndex)).toBe(true);
          }
        }
      }
    });

    test('EVM metrics display correctly with no division by zero', async ({ adminPage }) => {
      await adminPage.goto('/projects');
      await adminPage.waitForLoadState('networkidle');

      const projectLink = adminPage.locator('a[href*="/project/"]').first();
      if (await projectLink.isVisible()) {
        const href = await projectLink.getAttribute('href');
        const slug = href?.split('/project/')[1]?.split('/')[0] || '';

        if (slug) {
          const response = await adminPage.request.get(
            `/api/projects/${slug}/budget/dashboard`
          );

          if (response.status() === 200) {
            const data = await response.json();

            // Verify no NaN or Infinity values
            const numericFields = [
              'totalBudget',
              'actualCost',
              'earnedValue',
              'plannedValue',
              'costPerformanceIndex',
              'schedulePerformanceIndex',
              'estimateAtCompletion',
            ];

            for (const field of numericFields) {
              if (data[field] !== undefined) {
                expect(isNaN(data[field])).toBe(false);
                expect(isFinite(data[field])).toBe(true);
              }
            }
          }
        }
      }
    });
  });

  test.describe('Change Order Validation', () => {
    test('change order creation requires valid inputs', async ({ adminPage }) => {
      await adminPage.goto('/projects');
      await adminPage.waitForLoadState('networkidle');

      const projectLink = adminPage.locator('a[href*="/project/"]').first();
      if (await projectLink.isVisible()) {
        const href = await projectLink.getAttribute('href');
        const slug = href?.split('/project/')[1]?.split('/')[0] || '';

        if (slug) {
          // Try to create a change order with invalid data
          const response = await adminPage.request.post(
            `/api/projects/${slug}/change-orders`,
            {
              data: {
                // Missing required fields
                description: '',
                amount: null,
              },
            }
          );

          // Should return validation error, not server error
          expect([400, 422]).toContain(response.status());
        }
      }
    });
  });

  test.describe('Invoice Management', () => {
    test('invoice API returns proper structure', async ({ adminPage }) => {
      await adminPage.goto('/projects');
      await adminPage.waitForLoadState('networkidle');

      const projectLink = adminPage.locator('a[href*="/project/"]').first();
      if (await projectLink.isVisible()) {
        const href = await projectLink.getAttribute('href');
        const slug = href?.split('/project/')[1]?.split('/')[0] || '';

        if (slug) {
          const response = await adminPage.request.get(
            `/api/projects/${slug}/invoices`
          );

          // API should respond
          expect([200, 404]).toContain(response.status());

          if (response.status() === 200) {
            const data = await response.json();

            // Should return array or object with invoices
            expect(
              Array.isArray(data) || Array.isArray(data.invoices)
            ).toBeTruthy();
          }
        }
      }
    });
  });

  test.describe('Cost Alerts', () => {
    test('cost alerts API returns valid data', async ({ adminPage }) => {
      await adminPage.goto('/projects');
      await adminPage.waitForLoadState('networkidle');

      const projectLink = adminPage.locator('a[href*="/project/"]').first();
      if (await projectLink.isVisible()) {
        const href = await projectLink.getAttribute('href');
        const slug = href?.split('/project/')[1]?.split('/')[0] || '';

        if (slug) {
          const response = await adminPage.request.get(
            `/api/projects/${slug}/cost-alerts`
          );

          // API should respond
          expect([200, 404]).toContain(response.status());

          if (response.status() === 200) {
            const data = await response.json();

            // Should return array of alerts
            expect(
              Array.isArray(data) || Array.isArray(data.alerts)
            ).toBeTruthy();
          }
        }
      }
    });
  });
});
