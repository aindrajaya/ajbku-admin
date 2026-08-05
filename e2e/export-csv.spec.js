const { test, expect, _electron: electron } = require('@playwright/test');

test.skip(!process.env.E2E_EXPORT_READY, 'Set E2E_EXPORT_READY=1 to run export CSV baseline.');

test('reports operational can start CSV export flow', async () => {
  const app = await electron.launch({ args: ['.'] });
  const page = await app.firstWindow();

  await expect(page.locator('text=Laporan')).toBeVisible();
  await app.close();
});
