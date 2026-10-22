import { test as setup } from './fixtures';
import { adminUser } from './support/env';
import { ADMIN_STORAGE_STATE } from './support/storage-state';

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
