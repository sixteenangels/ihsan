import { expect, test } from '@playwright/test';

const smokeRoutes = [
  { path: '/', label: 'home', expectedText: /Featured Products|Group Buys|Flash Deals/i },
  { path: '/products', label: 'products', expectedText: /All Products|Filter Products|Search products/i },
  {
    path: '/profile',
    label: 'profile',
    expectedText: /Sign In|Create Account|Continue with Google/i,
    expectedUrl: /\/auth(?:[?#].*)?$/,
  },
  { path: '/auth', label: 'auth', expectedText: /Sign In|Create Account|Continue with Google/i },
  { path: '/help', label: 'help', expectedText: /How Can We Help|Still Need Help|Name|Email/i },
  { path: '/track-order', label: 'track-order', expectedText: /Track Your Order|Order Number/i },
];

for (const route of smokeRoutes) {
  test(`smoke: ${route.label} renders without page errors`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    const response = await page.goto(route.path, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    expect(response?.ok(), `expected ${route.path} to return a successful response`).toBeTruthy();
    if (route.expectedUrl) {
      await expect(page).toHaveURL(route.expectedUrl);
    }
    await expect(page.locator('body')).toContainText(route.expectedText, { timeout: 15000 });
    expect(pageErrors, `page errors on ${route.path}`).toEqual([]);
    expect(consoleErrors, `console errors on ${route.path}`).toEqual([]);
  });
}
