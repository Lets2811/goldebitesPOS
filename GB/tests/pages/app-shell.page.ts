import { expect, type Locator, type Page } from '@playwright/test';
import { adminUser } from '../support/env';

/** Layout autenticado: dashboard inicial y menú de usuario. */
export class AppShell {
  readonly dashboardHeading: Locator;
  /** Menú lateral: solo muestra los módulos que el rol puede usar. */
  readonly sidebarLinks: Locator;
  readonly forbiddenHeading: Locator;
  readonly forbiddenBackButton: Locator;
  /** El botón del menú no tiene aria-label: se identifica por el nombre del usuario. */
  readonly userMenuButton: Locator;
  readonly logoutMenuItem: Locator;

  constructor(
    private readonly page: Page,
    userFullName: string = adminUser.fullName,
  ) {
    this.dashboardHeading = page.getByRole('heading', { name: 'Centro de operaciones' });
    // El primer <nav> es el menú lateral (el breadcrumb viene después)
    this.sidebarLinks = page.getByRole('navigation').first().getByRole('link');
    this.forbiddenHeading = page.getByRole('heading', { name: 'No tienes acceso a este módulo' });
    this.forbiddenBackButton = page.getByRole('button', { name: 'Ir al centro de operaciones' });
    this.userMenuButton = page.getByRole('button', { name: userFullName });
    this.logoutMenuItem = page.getByRole('menuitem', { name: 'Cerrar sesión' });
  }

  async expectDashboard() {
    await expect(this.page).toHaveURL('/');
    await expect(this.dashboardHeading).toBeVisible();
  }

  async expectForbidden() {
    await expect(this.page).toHaveURL(/\/sin-acceso/);
    await expect(this.forbiddenHeading).toBeVisible();
  }

  async logout() {
    await this.userMenuButton.click();
    await this.logoutMenuItem.click();
  }
}
