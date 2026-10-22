import { expect, type Locator, type Page } from '@playwright/test';

/** Indicadores del Centro de operaciones, en el orden en que aparecen. */
export const DASHBOARD_INDICATORS = [
  'Ventas del día',
  'Pedidos realizados hoy',
  'Pedidos activos',
  'Ticket promedio',
  'Caja',
  'Insumos con stock bajo',
] as const;

export const DASHBOARD_SECTIONS = [
  'Ventas últimos 7 días',
  'Productos más vendidos',
  'Alertas operativas',
  'Pedidos en cocina',
] as const;

/** Centro de operaciones (ruta "/"). */
export class DashboardPage {
  readonly main: Locator;
  readonly heading: Locator;
  readonly viewKitchenButton: Locator;
  readonly loadError: Locator;
  readonly retryButton: Locator;

  constructor(private readonly page: Page) {
    this.main = page.locator('main');
    this.heading = this.main.getByRole('heading', { name: 'Centro de operaciones' });
    this.viewKitchenButton = this.main.getByRole('button', { name: 'Ver cocina' });
    this.loadError = this.main.getByText('Ocurrió un error al cargar la información');
    this.retryButton = this.main.getByRole('button', { name: 'Reintentar' });
  }

  async goto() {
    await this.page.goto('/');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL('/');
    await expect(this.heading).toBeVisible();
  }

  /** Etiqueta del indicador (el valor va encima y depende de los datos del día). */
  indicator(label: string): Locator {
    return this.main.getByText(label, { exact: true });
  }

  /** Los indicadores clickeables son botones cuyo nombre termina en su etiqueta ("$ 0 Ventas del día"). */
  indicatorButton(label: string): Locator {
    return this.main.getByRole('button', { name: new RegExp(`${label}$`) });
  }

  section(title: string): Locator {
    return this.main.getByText(title, { exact: true });
  }

  alert(title: string): Locator {
    return this.main.getByText(title, { exact: true });
  }
}
