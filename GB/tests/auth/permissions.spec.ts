import { expect, test } from '../fixtures';
import { apiURL, cashierUser, courierUser, kitchenUser } from '../support/env';
import { CASHIER_STORAGE_STATE, NO_SESSION } from '../support/storage-state';
import { apiLogin, enabledFeatures, ensureTestUser } from '../support/test-users';

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

      // Domicilios aparece porque el módulo está activo en el negocio
      await expect(appShell.sidebarLinks).toHaveText([
        'Centro de operaciones',
        'Pedidos',
        'Cocina',
        'Domicilios',
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

  test.describe('Repartidor (COURIER)', () => {
    test.use({ storageState: NO_SESSION });

    test.beforeAll(async ({ request }) => {
      await ensureTestUser(request, courierUser);

      const features = await enabledFeatures(request, courierUser.email, courierUser.password);
      if (!features.includes('deliveries')) {
        throw new Error(
          'El módulo Domicilios no está activo en Golden Bites. Actívalo (POS-ADMIN o business_features) para correr estos tests.',
        );
      }
    });

    test.beforeEach(async ({ loginPage }) => {
      await loginPage.goto();
      await loginPage.login(courierUser.email, courierUser.password);
    });

    test('TC-AUTH-042 - El repartidor entra directo a su app', async ({ page }) => {
      await expect(page).toHaveURL('/domiciliario');
      await expect(
        page.getByRole('heading', { name: 'Golden Bites · Domicilios' }),
      ).toBeVisible();

      for (const section of ['Mi ruta actual', 'Pendientes', 'Mis domicilios', 'Balance']) {
        await expect(page.getByRole('button', { name: new RegExp(`^${section}`) })).toBeVisible();
      }
    });

    test('TC-AUTH-043 - El repartidor no entra al back office', async ({ page }) => {
      await expect(page).toHaveURL('/domiciliario');

      for (const path of ['/', '/pedidos', '/caja']) {
        await test.step(`Intentar entrar a ${path}`, async () => {
          await page.goto(path);

          await expect(page).toHaveURL('/domiciliario');
        });
      }
    });

    test('TC-AUTH-044 - El repartidor cierra sesión desde su app', async ({ page, loginPage }) => {
      await expect(page).toHaveURL('/domiciliario');

      // exact: el botón "Pendientes · Asignados, por salir" también contiene "salir"
      await page.getByRole('button', { name: 'Salir', exact: true }).click();

      await loginPage.expectLoaded();
    });
  });
});
