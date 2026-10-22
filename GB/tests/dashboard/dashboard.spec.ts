import { expect, test } from '../fixtures';
import { DASHBOARD_INDICATORS, DASHBOARD_SECTIONS } from '../pages/dashboard.page';
import { CASHIER_STORAGE_STATE } from '../support/storage-state';

/**
 * Centro de operaciones. Estos tests no comprueban los valores (ventas,
 * pedidos...): dependen de los datos del día y se validarán cuando la suite
 * cree pedidos y pagos (módulos Pedido/Pago).
 *
 * Corren con la sesión del admin guardada por auth.setup.ts.
 */
test.describe('DASHBOARD - Centro de operaciones', () => {
  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.expectLoaded();
  });

  test('TC-DASH-001 - Mostrar indicadores y secciones', async ({ dashboardPage }) => {
    await expect(
      dashboardPage.main.getByText('Resumen en vivo de la operación de Golden Bites.'),
    ).toBeVisible();

    for (const label of DASHBOARD_INDICATORS) {
      await expect(dashboardPage.indicator(label)).toBeVisible();
    }
    for (const title of DASHBOARD_SECTIONS) {
      await expect(dashboardPage.section(title)).toBeVisible();
    }
  });

  test('TC-DASH-002 - Los indicadores llevan a su módulo', async ({ page, dashboardPage }) => {
    const destinations = [
      ['Ventas del día', '/pedidos'],
      ['Pedidos realizados hoy', '/pedidos'],
      ['Pedidos activos', '/pedidos'],
      ['Caja', '/caja'],
      ['Insumos con stock bajo', '/inventario'],
    ] as const;

    for (const [label, path] of destinations) {
      await test.step(`${label} → ${path}`, async () => {
        await dashboardPage.goto();
        await dashboardPage.indicatorButton(label).click();

        await expect(page).toHaveURL(path);
      });
    }
  });

  test('TC-DASH-003 - El ticket promedio no es clickeable', async ({ dashboardPage }) => {
    await expect(dashboardPage.indicator('Ticket promedio')).toBeVisible();
    await expect(dashboardPage.indicatorButton('Ticket promedio')).toHaveCount(0);
  });

  test(
    'TC-DASH-004 - Alerta de caja cerrada',
    {
      annotation: {
        type: 'precondicion',
        description:
          'Requiere que la sede no tenga una sesión de caja abierta. Los tests de Caja deben dejarla cerrada.',
      },
    },
    async ({ page, dashboardPage }) => {
      await expect(dashboardPage.indicatorButton('Caja')).toContainText('Cerrada');
      await expect(dashboardPage.alert('Caja cerrada')).toBeVisible();
      await expect(
        dashboardPage.main.getByText('No hay una sesión de caja abierta en este momento.'),
      ).toBeVisible();

      await dashboardPage.alert('Caja cerrada').click();

      await expect(page).toHaveURL('/caja');
    },
  );

  test('TC-DASH-005 - Ir a la cocina desde el panel de pedidos', async ({ page, dashboardPage }) => {
    await dashboardPage.viewKitchenButton.click();

    await expect(page).toHaveURL('/cocina');
    await expect(page.getByRole('heading', { name: 'Cocina', exact: true })).toBeVisible();
  });
});

test.describe('DASHBOARD - Errores', () => {
  test('TC-DASH-006 - Error al cargar el resumen y reintentar', async ({ page, dashboardPage }) => {
    await page.route('**/dashboard/summary*', (route) => route.fulfill({ status: 500, json: {} }));

    await dashboardPage.goto();

    await expect(dashboardPage.loadError).toBeVisible();
    await expect(dashboardPage.retryButton).toBeVisible();

    // El servidor se recupera: reintentar carga el resumen
    await page.unroute('**/dashboard/summary*');
    await dashboardPage.retryButton.click();

    await expect(dashboardPage.loadError).toBeHidden();
    await expect(dashboardPage.indicator('Ventas del día')).toBeVisible();
  });
});

test.describe('DASHBOARD - Cajero', () => {
  test.use({ storageState: CASHIER_STORAGE_STATE });

  test(
    'TC-DASH-007 - Indicador de insumos sin permiso de inventario',
    {
      annotation: {
        type: 'comportamiento-actual',
        description:
          'El cajero no tiene inventory.read, pero la tarjeta "Insumos con stock bajo" es clickeable y lleva a "No tienes acceso". Confirmar si es lo esperado.',
      },
    },
    async ({ dashboardPage, appShell }) => {
      await dashboardPage.goto();
      await dashboardPage.expectLoaded();

      await dashboardPage.indicatorButton('Insumos con stock bajo').click();

      await appShell.expectForbidden();
    },
  );
});
