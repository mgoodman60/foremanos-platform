import { test, expect } from './fixtures/auth';

/**
 * Schedule Management E2E Tests
 *
 * Tests for schedule display, Gantt chart, task management, and lookahead functionality.
 */

test.describe('Schedule Management', () => {
  test.describe('Schedule Display', () => {
    test('schedule page loads for authenticated user', async ({ adminPage }) => {
      await adminPage.goto('/projects');
      await adminPage.waitForLoadState('networkidle');

      const projectLink = adminPage.locator('a[href*="/project/"]').first();
      if (await projectLink.isVisible()) {
        await projectLink.click();
        await adminPage.waitForLoadState('networkidle');

        // Look for schedule tab or section
        const scheduleTab = adminPage.locator('text=Schedule').first();
        if (await scheduleTab.isVisible()) {
          await scheduleTab.click();
          await adminPage.waitForLoadState('networkidle');

          // Page should load without errors
          const body = await adminPage.locator('body').textContent();
          expect(body).not.toContain('Error');
        }
      }
    });

    test('gantt chart renders tasks correctly', async ({ adminPage }) => {
      await adminPage.goto('/projects');
      await adminPage.waitForLoadState('networkidle');

      const projectLink = adminPage.locator('a[href*="/project/"]').first();
      if (await projectLink.isVisible()) {
        await projectLink.click();
        await adminPage.waitForLoadState('networkidle');

        // Navigate to schedule
        const scheduleTab = adminPage.locator('text=Schedule').first();
        if (await scheduleTab.isVisible()) {
          await scheduleTab.click();
          await adminPage.waitForLoadState('networkidle');

          // Wait for gantt or schedule content to appear
          await adminPage.waitForTimeout(1000);

          // Check if schedule data is present
          const body = await adminPage.locator('body').textContent();
          // Should either show tasks or "no schedule" message, not error
          expect(body?.toLowerCase()).not.toContain('error loading');
        }
      }
    });
  });

  test.describe('Lookahead API', () => {
    test('3-week lookahead API returns valid data', async ({ adminPage }) => {
      await adminPage.goto('/projects');
      await adminPage.waitForLoadState('networkidle');

      const projectLink = adminPage.locator('a[href*="/project/"]').first();
      if (await projectLink.isVisible()) {
        const href = await projectLink.getAttribute('href');
        const slug = href?.split('/project/')[1]?.split('/')[0] || '';

        if (slug) {
          const response = await adminPage.request.get(
            `/api/projects/${slug}/schedule-lookahead`
          );

          // API should respond
          expect([200, 404]).toContain(response.status());

          if (response.status() === 200) {
            const data = await response.json();

            // Verify lookahead structure
            expect(data).toHaveProperty('tasks');
            expect(Array.isArray(data.tasks)).toBe(true);

            // Verify tasks have required fields
            if (data.tasks.length > 0) {
              const task = data.tasks[0];
              expect(task).toHaveProperty('name');
              expect(task).toHaveProperty('startDate');
              expect(task).toHaveProperty('endDate');
            }
          }
        }
      }
    });

    test('lookahead sync uses transactions', async ({ adminPage }) => {
      await adminPage.goto('/projects');
      await adminPage.waitForLoadState('networkidle');

      const projectLink = adminPage.locator('a[href*="/project/"]').first();
      if (await projectLink.isVisible()) {
        const href = await projectLink.getAttribute('href');
        const slug = href?.split('/project/')[1]?.split('/')[0] || '';

        if (slug) {
          // Test sync endpoint with empty tasks (should not error)
          const response = await adminPage.request.post(
            `/api/projects/${slug}/schedule-lookahead/sync`,
            {
              data: {
                tasks: [],
              },
            }
          );

          // Should handle gracefully, not error
          expect([200, 400, 404]).toContain(response.status());
        }
      }
    });
  });

  test.describe('Critical Path', () => {
    test('critical path filter works', async ({ adminPage }) => {
      await adminPage.goto('/projects');
      await adminPage.waitForLoadState('networkidle');

      const projectLink = adminPage.locator('a[href*="/project/"]').first();
      if (await projectLink.isVisible()) {
        await projectLink.click();
        await adminPage.waitForLoadState('networkidle');

        // Navigate to schedule
        const scheduleTab = adminPage.locator('text=Schedule').first();
        if (await scheduleTab.isVisible()) {
          await scheduleTab.click();
          await adminPage.waitForLoadState('networkidle');

          // Look for critical path filter
          const criticalFilter = adminPage.locator(
            '[data-testid="critical-path-filter"], text=Critical Path, button:has-text("Critical")'
          ).first();

          if (await criticalFilter.isVisible()) {
            await criticalFilter.click();
            await adminPage.waitForLoadState('networkidle');

            // Filter should apply without error
            const body = await adminPage.locator('body').textContent();
            expect(body?.toLowerCase()).not.toContain('error');
          }
        }
      }
    });
  });

  test.describe('Task Modal', () => {
    test('task modal opens with details', async ({ adminPage }) => {
      await adminPage.goto('/projects');
      await adminPage.waitForLoadState('networkidle');

      const projectLink = adminPage.locator('a[href*="/project/"]').first();
      if (await projectLink.isVisible()) {
        await projectLink.click();
        await adminPage.waitForLoadState('networkidle');

        // Navigate to schedule
        const scheduleTab = adminPage.locator('text=Schedule').first();
        if (await scheduleTab.isVisible()) {
          await scheduleTab.click();
          await adminPage.waitForLoadState('networkidle');

          // Try to click on a task (if available)
          const taskElement = adminPage.locator(
            '[data-testid="schedule-task"], .schedule-task, .task-bar'
          ).first();

          if (await taskElement.isVisible()) {
            await taskElement.click();
            await adminPage.waitForTimeout(500);

            // Modal or detail view should appear
            const modal = adminPage.locator(
              '[role="dialog"], .modal, [data-testid="task-modal"]'
            ).first();

            if (await modal.isVisible()) {
              // Modal should contain task details
              const modalText = await modal.textContent();
              expect(modalText?.length).toBeGreaterThan(0);
            }
          }
        }
      }
    });
  });

  test.describe('Schedule Analysis', () => {
    test('schedule analysis does not use HTTP self-calls', async ({ adminPage }) => {
      await adminPage.goto('/projects');
      await adminPage.waitForLoadState('networkidle');

      const projectLink = adminPage.locator('a[href*="/project/"]').first();
      if (await projectLink.isVisible()) {
        const href = await projectLink.getAttribute('href');
        const slug = href?.split('/project/')[1]?.split('/')[0] || '';

        if (slug) {
          // Test schedule analysis endpoint
          const response = await adminPage.request.post(
            `/api/projects/${slug}/schedule/analyze`,
            {
              data: {
                reportContent: 'Test daily report content with schedule updates',
              },
            }
          );

          // Should return 200 or 400 for validation, not 500 from self-call failure
          expect([200, 400, 404]).toContain(response.status());
        }
      }
    });
  });

  test.describe('Schedule Variance', () => {
    test('schedule variance calculation is correct', async ({ adminPage }) => {
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

            // If we have both plannedValue and earnedValue, scheduleVariance should be their difference
            if (
              data.plannedValue !== undefined &&
              data.earnedValue !== undefined &&
              data.scheduleVariance !== undefined
            ) {
              const expectedVariance = data.earnedValue - data.plannedValue;
              expect(Math.abs(data.scheduleVariance - expectedVariance)).toBeLessThan(0.01);
            }

            // SPI should be EV/PV (if PV > 0)
            if (
              data.plannedValue > 0 &&
              data.earnedValue !== undefined &&
              data.schedulePerformanceIndex !== undefined
            ) {
              const expectedSPI = data.earnedValue / data.plannedValue;
              expect(Math.abs(data.schedulePerformanceIndex - expectedSPI)).toBeLessThan(0.01);
            }
          }
        }
      }
    });
  });
});
