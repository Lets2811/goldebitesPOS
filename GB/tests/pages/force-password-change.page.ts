import { expect, type Locator, type Page } from '@playwright/test';

export class ForcePasswordChangePage {
  readonly currentPasswordInput: Locator;
  readonly newPasswordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly logoutLink: Locator;

  constructor(private readonly page: Page) {
    this.currentPasswordInput = page.getByRole('textbox', { name: 'Contraseña actual' });
    this.newPasswordInput = page.getByRole('textbox', { name: 'Nueva contraseña', exact: true });
    this.confirmPasswordInput = page.getByRole('textbox', { name: 'Confirmar nueva contraseña' });
    this.submitButton = page.getByRole('button', { name: 'Guardar y continuar' });
    this.logoutLink = page.getByRole('button', { name: 'Cerrar sesión' });
  }

  async changePassword(current: string, next: string, confirm = next) {
    await this.currentPasswordInput.fill(current);
    await this.newPasswordInput.fill(next);
    await this.confirmPasswordInput.fill(confirm);
    await this.submitButton.click();
  }

  error(message: string): Locator {
    return this.page.getByText(message, { exact: true });
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/cambiar-contrasena/);
    await expect(this.page.getByRole('heading', { name: 'Cambia tu contraseña' })).toBeVisible();
  }
}
