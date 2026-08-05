const { test, expect, _electron: electron } = require('@playwright/test');

test.skip(!process.env.E2E_VERIFY_URL, 'Set E2E_VERIFY_URL to run verify baseline.');

test('verify page accepts valid document flow', async () => {
  const app = await electron.launch({ args: ['.'] });
  const page = await app.firstWindow();

  await page.goto(process.env.E2E_VERIFY_URL);
  await expect(page.locator('text=Verifikasi Dokumen')).toBeVisible();

  await app.close();
});
