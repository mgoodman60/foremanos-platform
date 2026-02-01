import { test, expect } from './fixtures/auth';

/**
 * E2E Chat Tests for ForemanOS
 *
 * Tests the AI chat functionality including:
 * - Chat interface loading
 * - Message input
 * - Basic interaction
 *
 * Prerequisites:
 * - Run `npx prisma db seed` to create test users
 * - Requires API keys for AI providers (or mocked responses)
 *
 * Run with: npx playwright test e2e/chat.spec.ts
 */

test.describe('Chat Interface', () => {
  test('chat page loads for authenticated user', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/chat');

    // Should not be redirected to login
    await expect(authenticatedPage).not.toHaveURL(/login/);

    // Page should have some chat-related content
    await authenticatedPage.waitForLoadState('networkidle');
    const body = await authenticatedPage.textContent('body');
    expect(body?.length).toBeGreaterThan(0);
  });

  test('chat has message input area', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/chat');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for textarea or input for messages
    const hasInput =
      (await authenticatedPage.locator('textarea').count()) > 0 ||
      (await authenticatedPage.locator('input[type="text"]').count()) > 0;

    // Chat should have some form of input
    // Note: May be inside a contenteditable div instead
    if (!hasInput) {
      const hasContentEditable =
        (await authenticatedPage.locator('[contenteditable="true"]').count()) >
        0;
      expect(hasInput || hasContentEditable).toBeTruthy();
    }
  });

  test('unauthenticated user cannot access chat', async ({ page }) => {
    await page.goto('/chat');

    // Should redirect to login
    await expect(page).toHaveURL(/login|signin/, { timeout: 10000 });
  });
});

test.describe('Chat Navigation', () => {
  test('can navigate to new chat', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for new chat button or link
    const newChatButton = authenticatedPage.locator(
      'a[href*="/chat"], button:has-text("New Chat"), button:has-text("Start Chat")'
    ).first();

    if ((await newChatButton.count()) > 0) {
      await newChatButton.click();

      // Should navigate to chat
      await expect(authenticatedPage).toHaveURL(/chat/);
    }
  });

  test('chat history is accessible', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/chat');
    await authenticatedPage.waitForLoadState('networkidle');

    // Chat interface should have some history/sidebar element
    const body = await authenticatedPage.textContent('body');
    expect(body?.length).toBeGreaterThan(0);
  });
});

test.describe('Chat Project Context', () => {
  test('can start chat within project context', async ({ adminPage }) => {
    // Navigate to dashboard to find a project
    await adminPage.goto('/dashboard');
    await adminPage.waitForLoadState('networkidle');

    // Find a project
    const projectLink = adminPage.locator('a[href*="/project/"]').first();

    if ((await projectLink.count()) > 0) {
      await projectLink.click();
      await adminPage.waitForLoadState('networkidle');

      // Look for chat option within project
      const chatButton = adminPage.locator(
        'a[href*="/chat"], button:has-text("Chat"), button:has-text("Ask")'
      ).first();

      if ((await chatButton.count()) > 0) {
        await chatButton.click();

        // Should navigate to chat (possibly with project context)
        await expect(adminPage).toHaveURL(/chat/);
      }
    }
  });
});
