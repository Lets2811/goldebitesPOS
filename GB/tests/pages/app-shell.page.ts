import { expect, type Locator, type Page } from '@playwright/test';
import { adminUser } from '../support/env';

/** Layout autenticado: dashboard inicial y menú de usuario. */
export class AppShell {
  readonly dashboardHeading: Locator;
  /** El botón del menú no tiene aria-label: se identifica por el nombre del usuario. */
  readonly userMenuButton: Locator;
  readonly logoutMenuItem: Locator;

  constructor(
    private readonly page: Page,
    userFullName: string = adminUser.fullName,
  ) {
    this.dashboardHeading = page.getByRole('heading', { name: 'Centro de operaciones' });
    this.userMenuButton = page.getByRole('button', { name: userFullName });
    this.logoutMenuItem = page.getByRole('menuitem', { name: 'Cerrar sesión' });
  }

  async expectDashboard() {
    await expect(this.page).toHaveURL('/');
    await expect(this.dashboardHeading).toBeVisible();
  }

  async logout() {
    await this.userMenuButton.click();
    await this.logoutMenuItem.click();
  }
}
