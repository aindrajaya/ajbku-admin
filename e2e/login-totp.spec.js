const { test, expect, _electron: electron } = require('@playwright/test');

const shouldRun = process.env.E2E_AUTH_EMAIL && process.env.E2E_AUTH_PASSWORD && process.env.E2E_TENANT_CODE && process.env.E2E_TOTP_CODE;

test.skip(!shouldRun, 'Set E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD, E2E_TENANT_CODE, and E2E_TOTP_CODE to run Electron auth baseline.');

test('login stops at TOTP and reaches dashboard after verification', async () => {
  const app = await electron.launch({ args: ['.'] });
  const page = await app.firstWindow();

  await page.fill('#tenantCode', process.env.E2E_TENANT_CODE);
  await page.fill('#email', process.env.E2E_AUTH_EMAIL);
  await page.fill('#password', process.env.E2E_AUTH_PASSWORD);
  await page.click('text=Masuk Akun');

  await expect(page.locator('text=Verifikasi Dua Langkah')).toBeVisible();
  await page.fill('#totpCode', process.env.E2E_TOTP_CODE);
  await page.click('text=Verifikasi & Masuk');

  await expect(page.locator('text=Dashboard')).toBeVisible();
  await app.close();
});
