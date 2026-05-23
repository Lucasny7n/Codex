import { test, expect } from '@playwright/test';

test.describe('Ailu AI Studio MVP', () => {
  test('App abre e mostra Operator View', async ({ page }) => {
    await page.goto('/');
    
    // Sidebar renders
    await expect(page.locator('.sidebar-title')).toHaveText('Ailu Studio');
    
    // Header renders
    await expect(page.locator('.app-header')).toBeVisible();
    
    // Chat shows initial system message
    await expect(page.locator('.chat-message-content').first()).toContainText('Ailu Neural Core');
  });
});
