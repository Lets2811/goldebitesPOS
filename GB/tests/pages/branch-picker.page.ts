import { expect, type Locator, type Page } from '@playwright/test';

/** Pantalla "¿En qué sede vas a trabajar?" que aparece después del login. */
export class BranchPickerPage {
  readonly question: Locator;
  readonly allBranchesOption: Locator;
  readonly logoutButton: Locator;

  constructor(private readonly page: Page) {
    this.question = page.getByText('¿En qué sede vas a trabajar?');
    this.allBranchesOption = page.getByRole('button', { name: /Todas las sedes/ });
    this.logoutButton = page.getByRole('button', { name: 'Cerrar sesión' });
  }

  branchOption(name: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${name}`) });
  }

  async expectLoaded() {
    await expect(this.question).toBeVisible();
  }
}
