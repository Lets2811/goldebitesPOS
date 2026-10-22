import { expect, test } from '../fixtures';
import { forceBranchSelection } from '../support/api-mocks';
import { adminUser } from '../support/env';
import { NO_SESSION } from '../support/storage-state';

/** Única sede del negocio Golden Bites en el seed. */
const MAIN_BRANCH = 'Sede Principal';

/**
 * La selección de sede aparece cuando el negocio tiene varias sedes activas
 * y el rol puede cambiar de sede (branches.switch). La base local tiene una
 * sola sede, así que se simula (ver forceBranchSelection).
 */
test.describe('AUTH - Selección de sede', () => {
  test.use({ storageState: NO_SESSION });

  test.beforeEach(async ({ page, loginPage, branchPickerPage }) => {
    await forceBranchSelection(page);

    await test.step('Iniciar sesión con un usuario que debe elegir sede', async () => {
      await loginPage.goto();
      await loginPage.login(adminUser.email, adminUser.password);
      await branchPickerPage.expectLoaded();
    });
  });

  test('TC-AUTH-039 - Pedir la sede antes de cargar la aplicación', async ({
    branchPickerPage,
    appShell,
  }) => {
    await expect(branchPickerPage.branchOption(MAIN_BRANCH)).toBeVisible();
    await expect(branchPickerPage.allBranchesOption).toBeVisible();

    // Nada de la aplicación se carga hasta elegir sede
    await expect(appShell.dashboardHeading).toBeHidden();
  });

  test('TC-AUTH-040 - Elegir sede y entrar a la aplicación', async ({
    branchPickerPage,
    appShell,
  }) => {
    await branchPickerPage.branchOption(MAIN_BRANCH).click();

    await appShell.expectDashboard();
    await expect(branchPickerPage.question).toBeHidden();
  });

  test('TC-AUTH-041 - Cerrar sesión desde la selección de sede', async ({
    page,
    loginPage,
    branchPickerPage,
  }) => {
    await branchPickerPage.logoutButton.click();

    await loginPage.expectLoaded();

    await page.goto('/');
    await loginPage.expectLoaded();
  });
});
