import { expect, test } from '../fixtures';
import { API, forceMustChangePassword } from '../support/api-mocks';
import { adminUser } from '../support/env';
import { NO_SESSION } from '../support/storage-state';

/**
 * El seed no tiene usuarios con must_change_password, así que se simula
 * sobre la respuesta real del login del admin (ver forceMustChangePassword).
 * Ningún test cambia de verdad la contraseña del admin.
 */
test.describe('AUTH - Cambio de contraseña obligatorio', () => {
  test.use({ storageState: NO_SESSION });

  test.beforeEach(async ({ page, loginPage, forcePasswordChangePage }) => {
    await forceMustChangePassword(page);

    await test.step('Iniciar sesión con una cuenta que debe cambiar contraseña', async () => {
      await loginPage.goto();
      await loginPage.login(adminUser.email, adminUser.password);
      await forcePasswordChangePage.expectLoaded();
    });
  });

  test('TC-AUTH-025 - Impedir acceso a otras rutas hasta cambiar la contraseña', async ({
    page,
    forcePasswordChangePage,
  }) => {
    await page.goto('/mi-perfil');
    await forcePasswordChangePage.expectLoaded();

    await page.goto('/');
    await forcePasswordChangePage.expectLoaded();
  });

  test('TC-AUTH-026 - Validaciones del formulario', async ({ forcePasswordChangePage: form }) => {
    await test.step('Campos obligatorios', async () => {
      await form.submitButton.click();

      await expect(form.error('Ingresa tu contraseña actual')).toBeVisible();
      await expect(form.error('Debe tener al menos 8 caracteres')).toBeVisible();
      await expect(form.error('Confirma tu nueva contraseña')).toBeVisible();
    });

    await test.step('Nueva contraseña demasiado corta', async () => {
      await form.changePassword(adminUser.password, 'Corta1!');

      await expect(form.error('Debe tener al menos 8 caracteres')).toBeVisible();
    });

    await test.step('Confirmación distinta', async () => {
      await form.changePassword(adminUser.password, 'NuevaClave123!', 'OtraClave123!');

      await expect(form.error('Las contraseñas no coinciden')).toBeVisible();
    });

    await test.step('Nueva contraseña igual a la actual', async () => {
      await form.changePassword(adminUser.password, adminUser.password);

      await expect(form.error('La nueva contraseña debe ser distinta a la actual')).toBeVisible();
    });

    await form.expectLoaded();
  });

  test('TC-AUTH-027 - Contraseña actual incorrecta', async ({ forcePasswordChangePage: form }) => {
    // Va al backend real: con la contraseña actual incorrecta no cambia nada
    await form.changePassword('ClaveIncorrecta123!', 'NuevaClave123!');

    await expect(form.error('La contraseña actual es incorrecta.')).toBeVisible();
    await form.expectLoaded();
  });

  test('TC-AUTH-028 - Cambio de contraseña exitoso', async ({
    page,
    loginPage,
    forcePasswordChangePage: form,
  }) => {
    // Simulado: un cambio real dejaría al admin del seed con otra contraseña
    let payload: unknown;
    await page.route(API.changePassword, (route) => {
      payload = route.request().postDataJSON();
      return route.fulfill({ status: 200, json: {} });
    });

    await form.changePassword(adminUser.password, 'NuevaClave123!');

    await loginPage.expectLoaded();
    expect(payload).toEqual({
      currentPassword: adminUser.password,
      newPassword: 'NuevaClave123!',
    });
  });

  test(
    'TC-AUTH-031 - Aviso de contraseña actualizada',
    {
      annotation: {
        type: 'bug-conocido',
        description:
          'El aviso está programado en ForcePasswordChangePage pero no se muestra: la página se desmonta antes del callback de mutate().',
      },
    },
    async ({ page, forcePasswordChangePage: form }) => {
      // Cuando se corrija, este test empezará a "fallar" como aviso: quitar test.fail
      test.fail();

      await page.route(API.changePassword, (route) => route.fulfill({ status: 200, json: {} }));

      await form.changePassword(adminUser.password, 'NuevaClave123!');

      await expect(
        page.getByText('Contraseña actualizada. Inicia sesión de nuevo.', { exact: true }),
      ).toBeVisible();
    },
  );

  test('TC-AUTH-029 - Cerrar sesión desde el cambio de contraseña', async ({
    page,
    loginPage,
    forcePasswordChangePage: form,
  }) => {
    await form.logoutLink.click();

    await loginPage.expectLoaded();

    await page.goto('/');
    await loginPage.expectLoaded();
  });
});
