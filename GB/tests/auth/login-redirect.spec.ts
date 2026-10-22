import { expect, test } from '../fixtures';
import { adminUser, platformAdminUser } from '../support/env';
import { NO_SESSION } from '../support/storage-state';

test.describe('AUTH - Redirección después del login', () => {
  test.use({ storageState: NO_SESSION });

  test('TC-AUTH-019 - Volver a la ruta solicitada antes del login', async ({ page, loginPage }) => {
    await page.goto('/mi-perfil');
    await loginPage.expectLoaded();

    await loginPage.login(adminUser.email, adminUser.password);

    await expect(page).toHaveURL('/mi-perfil');
    await expect(page.getByRole('heading', { name: 'Mi Perfil' })).toBeVisible();
  });

  test('TC-AUTH-020 - Admin de plataforma entra al panel de plataforma', async ({
    page,
    loginPage,
  }) => {
    await loginPage.goto();

    await loginPage.login(platformAdminUser.email, platformAdminUser.password);

    await expect(page).toHaveURL('/plataforma');
    await expect(
      page.getByRole('heading', { name: 'Administración de plataforma' }),
    ).toBeVisible();
  });

  test('TC-AUTH-021 - Admin de plataforma ignora la ruta solicitada', async ({
    page,
    loginPage,
  }) => {
    await page.goto('/mi-perfil');
    await loginPage.expectLoaded();

    await loginPage.login(platformAdminUser.email, platformAdminUser.password);

    await expect(page).toHaveURL('/plataforma');
  });
});
