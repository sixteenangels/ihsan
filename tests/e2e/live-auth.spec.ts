import { expect, test } from '@playwright/test';

const liveBaseUrl = process.env.PLAYWRIGHT_LIVE_BASE_URL;

test.describe('live auth smoke', () => {
  test.skip(!liveBaseUrl, 'Set PLAYWRIGHT_LIVE_BASE_URL to enable live deployment auth checks.');

  test('google auth starts from the deployed auth page', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The live auth smoke only needs one desktop pass.');

    await page.goto(`${liveBaseUrl}/auth`, { waitUntil: 'networkidle', timeout: 30000 });

    await expect(page).toHaveURL(/\/auth(?:[?#].*)?$/);

    const googleButton = page.getByRole('button', { name: /continue with google/i });
    await expect(googleButton).toBeVisible();

    await Promise.all([
      page.waitForURL(/accounts\.google\.com|supabase\.co\/auth\/v1\/authorize/, {
        timeout: 15000,
      }),
      googleButton.click(),
    ]);
  });
});
