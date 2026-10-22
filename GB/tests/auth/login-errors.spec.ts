import { expect, test } from '../fixtures';
import { API, holdRequest } from '../support/api-mocks';
import { adminUser } from '../support/env';
import { NO_SESSION } from '../support/storage-state';

test.describe('AUTH - Estados de carga y errores del servidor', () => {
  test.use({ storageState: NO_SESSION });

  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('TC-AUTH-022 - Botón deshabilitado mientras se procesa el login', async ({
    page,
    loginPage,
    appShell,
  }) => {
    const loginRequest = await holdRequest(page, API.login);

    await loginPage.login(adminUser.email, adminUser.password);

    // Evita el doble envío mientras la petición está en curso
    const pendingButton = page.getByRole('button', { name: 'Ingresando...' });
    await expect(pendingButton).toBeVisible();
    await expect(pendingButton).toBeDisabled();

    loginRequest.release();

    await appShell.expectDashboard();
  });

  test('TC-AUTH-023 - Error interno del servidor', async ({ page, loginPage }) => {
    await page.route(API.login, (route) => route.fulfill({ status: 500, json: {} }));

    await loginPage.login(adminUser.email, adminUser.password);

    await expect(loginPage.error('Ocurrió un error inesperado en el servidor.')).toBeVisible();
    await loginPage.expectLoaded();
    await expect(loginPage.submitButton).toBeEnabled();
  });

  test('TC-AUTH-024 - Servidor no disponible', async ({ page, loginPage }) => {
    await page.route(API.login, (route) => route.abort('connectionrefused'));

    await loginPage.login(adminUser.email, adminUser.password);

    await expect(
      loginPage.error('No fue posible conectar con el servidor. Verifica tu conexión.'),
    ).toBeVisible();
    await loginPage.expectLoaded();
    await expect(loginPage.submitButton).toBeEnabled();
  });
});
