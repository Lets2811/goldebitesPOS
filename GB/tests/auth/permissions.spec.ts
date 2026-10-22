import { expect, test } from '../fixtures';
import { apiURL, cashierUser, kitchenUser } from '../support/env';
import { CASHIER_STORAGE_STATE, NO_SESSION } from '../support/storage-state';
import { apiLogin, ensureTestUser } from '../support/test-users';

/**
 * Permisos por rol. Los resultados esperados son los observados en la app
 * con los roles de sistema (permissions.constants.ts en GB-BE).
 */
test.describe('AUTH - Permisos por rol', () => {
  test.describe('Cajero (CASHIER)', () => {
    test.use({ storageState: CASHIER_STORAGE_STATE });

    test('TC-AUTH-032 - El menú lateral muestra solo los módulos del rol', async ({
      page,
      appShell,
    }) => {
      await page.goto('/');
      await appShell.expectDashboard();

      await expect(appShell.sidebarLinks).toHaveText([
        'Centro de operaciones',
        'Pedidos',
        'Cocina',
        'Caja',
        'Productos y recetas',
        'Checklists',
      ]);
    });

    test('TC-AUTH-033 - Acceso a módulos permitidos', async ({ page }) => {
      for (const [path, heading] of [
        ['/caja', 'Caja'],
        ['/pedidos', 'Pedidos'],
      ]) {
        await test.step(`Entrar a ${path}`, async () => {
          await page.goto(path);

          await expect(page).toHaveURL(path);
          await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
        });
      }
    });

    test('TC-AUTH-034 - Bloquear módulos no permitidos por URL directa', async ({
      page,
      appShell,
    }) => {
      for (const path of [
        '/finanzas',
        '/inventario',
        '/configuracion',
        '/recursos-humanos/personal',
      ]) {
        await test.step(`Intentar entrar a ${path}`, async () => {
          await page.goto(path);

          await appShell.expectForbidden();
        });
      }
    });

    test('TC-AUTH-035 - Volver al centro de operaciones desde "sin acceso"', async ({
      page,
      appShell,
    }) => {
      await page.goto('/finanzas');
      await appShell.expectForbidden();

      await appShell.forbiddenBackButton.click();

      await appShell.expectDashboard();
    });

    test('TC-AUTH-036 - El backend rechaza la API de un módulo no permitido', async ({
      request,
    }) => {
      // No basta con ocultar el menú: la API también debe bloquear
      const token = await apiLogin(request, cashierUser.email, cashierUser.password);

      const response = await request.get(`${apiURL}/expenses`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status()).toBe(403);
    });
  });

  test.describe('Cocina (KITCHEN)', () => {
    test.use({ storageState: NO_SESSION });

    // Comportamiento confirmado: KITCHEN no tiene dashboard.read, así que
    // después del login ve "No tienes acceso" y entra a sus módulos desde el menú.
    test('TC-AUTH-037 - Cocinero sin Centro de operaciones entra a sus módulos desde el menú', async ({
      page,
      request,
      loginPage,
      appShell,
    }) => {
      await ensureTestUser(request, kitchenUser);
      await loginPage.goto();

      await loginPage.login(kitchenUser.email, kitchenUser.password);

      await appShell.expectForbidden();
      await expect(appShell.sidebarLinks).toHaveText(['Pedidos', 'Cocina', 'Checklists']);

      await appShell.sidebarLinks.filter({ hasText: 'Cocina' }).click();

      await expect(page).toHaveURL('/cocina');
      await expect(page.getByRole('heading', { name: 'Cocina', exact: true })).toBeVisible();
    });
  });
});
