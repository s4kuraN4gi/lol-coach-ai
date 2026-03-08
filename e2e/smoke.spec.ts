import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    // Title contains "LoL Coach AI" in any locale
    await expect(page).toHaveTitle(/LoL Coach AI/i);
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
  });

  test('signup page loads', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('#signup-email')).toBeVisible();
    await expect(page.locator('#signup-password')).toBeVisible();
  });

  test('guest analysis page loads', async ({ page }) => {
    await page.goto('/analyze');
    // Should render without application error
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('unauthenticated user redirected from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/(login|auth)/);
  });
});
