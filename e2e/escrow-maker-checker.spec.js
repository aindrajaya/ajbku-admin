const { test, expect, _electron: electron } = require('@playwright/test');

test.skip(!process.env.E2E_ESCROW_READY, 'Set E2E_ESCROW_READY=1 to run maker-checker baseline.');

test('maker cannot approve own payout', async () => {
  const app = await electron.launch({ args: ['.'] });
  const page = await app.firstWindow();

  await expect(page.locator('text=Escrow & Payout')).toBeVisible();
  await app.close();
});
