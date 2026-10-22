import { expect, test as setup } from './fixtures';
import { adminUser, cashierUser } from './support/env';
import { ADMIN_STORAGE_STATE, CASHIER_STORAGE_STATE } from './support/storage-state';
import { ensureTestUser } from './support/test-users';

/**
 * Inicia sesión una sola vez por corrida y guarda la sesión, para que los
 * tests de otros módulos no pasen por la UI de Login (y no choquen con el
 * throttling de /auth/login).
 */
setup('Autenticar admin', async ({ page, loginPage, appShell }) => {
  await loginPage.goto();
  await loginPage.login(adminUser.email, adminUser.password);
  await appShell.expectDashboard();

  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});

setup('Autenticar cajero', async ({ page, request, loginPage }) => {
  await ensureTestUser(request, cashierUser);

  await loginPage.goto();
  await loginPage.login(cashierUser.email, cashierUser.password);
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: CASHIER_STORAGE_STATE });
});
