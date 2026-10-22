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

  // TC-AUTH-020 y 021 (admin de plataforma redirigido a /plataforma) se
  // retiraron: desde la migración 088 las cuentas de plataforma usan la app
  // Admin aparte y su cuenta del lado del POS quedó inactiva. Ver TC-AUTH-038.

  test('TC-AUTH-038 - Cuenta de plataforma no puede entrar al POS', async ({ loginPage }) => {
    await loginPage.goto();

    await loginPage.login(platformAdminUser.email, platformAdminUser.password);

    await expect(
      loginPage.error('Tu cuenta no está activa. Contacta a tu administrador.'),
    ).toBeVisible();
    await loginPage.expectLoaded();
  });
});
