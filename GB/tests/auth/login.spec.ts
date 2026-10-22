import { expect, test } from '../fixtures';
import { adminUser } from '../support/env';
import { NO_SESSION } from '../support/storage-state';

const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos.';

test.describe('AUTH - Login', () => {
  // Estos tests prueban el propio Login: siempre empiezan sin sesión.
  test.use({ storageState: NO_SESSION });

  test.describe('Formulario', () => {
    test.beforeEach(async ({ loginPage }) => {
      await loginPage.goto();
    });

    test('TC-AUTH-001 - Mostrar pantalla de Login', async ({ loginPage }) => {
      await loginPage.expectLoaded();
      await expect(loginPage.passwordInput).toBeVisible();
    });

    test('TC-AUTH-002 - Correo electrónico obligatorio', async ({ loginPage }) => {
      await loginPage.passwordInput.fill('Password123');
      await loginPage.submitButton.click();

      await expect(loginPage.error('Ingresa tu correo')).toBeVisible();
      await loginPage.expectLoaded();
    });

    test('TC-AUTH-003 - Contraseña obligatoria', async ({ loginPage }) => {
      await loginPage.emailInput.fill('usuario@prueba.com');
      await loginPage.submitButton.click();

      await expect(loginPage.error('Ingresa tu contraseña')).toBeVisible();
      await loginPage.expectLoaded();
    });

    test('TC-AUTH-004 - Formato de correo electrónico inválido', async ({ loginPage }) => {
      await loginPage.login('SDAD', 'Password123');

      await expect(loginPage.error('Ingresa un correo válido')).toBeVisible();
      await loginPage.expectLoaded();
    });

    test('TC-AUTH-010 - Correo y contraseña obligatorios', async ({ loginPage }) => {
      await loginPage.submitButton.click();

      await expect(loginPage.error('Ingresa tu correo')).toBeVisible();
      await expect(loginPage.error('Ingresa tu contraseña')).toBeVisible();
      await loginPage.expectLoaded();
    });

    test('TC-AUTH-015 - Campo contraseña enmascarado', async ({ loginPage }) => {
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');

      await loginPage.passwordInput.fill('Password123');

      await expect(loginPage.passwordInput).toHaveValue('Password123');
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    });
  });

  test.describe('Credenciales', () => {
    test.beforeEach(async ({ loginPage }) => {
      await loginPage.goto();
    });

    test('TC-AUTH-005 - Credenciales incorrectas', async ({ loginPage }) => {
      await loginPage.login('usuario.inexistente@prueba.com', 'Password123');

      await expect(loginPage.error(INVALID_CREDENTIALS)).toBeVisible();
      await loginPage.expectLoaded();
    });

    test('TC-AUTH-013 - Contraseña incorrecta para usuario existente', async ({ loginPage }) => {
      await loginPage.login(adminUser.email, 'PasswordIncorrecto123!');

      // Mismo mensaje que TC-AUTH-005: no revela si la cuenta existe
      await expect(loginPage.error(INVALID_CREDENTIALS)).toBeVisible();
      await loginPage.expectLoaded();
    });

    test('TC-AUTH-006 - Inicio de sesión exitoso', async ({ loginPage, appShell }) => {
      await loginPage.login(adminUser.email, adminUser.password);

      await appShell.expectDashboard();
      // El menú de usuario muestra el nombre del usuario autenticado
      await expect(appShell.userMenuButton).toBeVisible();
    });

    test('TC-AUTH-014 - Iniciar sesión presionando Enter', async ({ loginPage, appShell }) => {
      await loginPage.emailInput.fill(adminUser.email);
      await loginPage.passwordInput.fill(adminUser.password);
      await loginPage.passwordInput.press('Enter');

      await appShell.expectDashboard();
    });

    test('TC-AUTH-011 - Login con espacios al inicio y final del correo', async ({
      loginPage,
      appShell,
    }) => {
      // Hoy pasa porque el input es type="email" y el navegador recorta los
      // espacios; el schema de zod no hace .trim().
      await loginPage.login(`   ${adminUser.email}   `, adminUser.password);

      await appShell.expectDashboard();
    });

    test(
      'TC-AUTH-012 - Login con correo en mayúsculas',
      {
        annotation: {
          type: 'comportamiento-actual',
          description: 'El login distingue mayúsculas en el correo. Confirmar si es intencional.',
        },
      },
      async ({ loginPage }) => {
        await loginPage.login(adminUser.email.toUpperCase(), adminUser.password);

        await expect(loginPage.error(INVALID_CREDENTIALS)).toBeVisible();
        await loginPage.expectLoaded();
      },
    );
  });

  test.describe('Sesión', () => {
    test.beforeEach(async ({ loginPage, appShell }) => {
      await test.step('Iniciar sesión como admin', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.email, adminUser.password);
        await appShell.expectDashboard();
      });
    });

    test('TC-AUTH-007 - Cerrar sesión', async ({ loginPage, appShell }) => {
      await appShell.logout();

      await loginPage.expectLoaded();
    });

    test(
      'TC-AUTH-030 - Aviso "Sesión cerrada" después del logout',
      {
        annotation: {
          type: 'bug-conocido',
          description:
            'El aviso está programado en UserMenu pero no se muestra: el componente se desmonta antes del callback de mutate().',
        },
      },
      async ({ page, appShell }) => {
        // Cuando se corrija, este test empezará a "fallar" como aviso: quitar test.fail
        test.fail();

        await appShell.logout();

        await expect(page.getByText('Sesión cerrada', { exact: true })).toBeVisible();
      },
    );

    test('TC-AUTH-008 - Impedir acceso después de cerrar sesión', async ({
      page,
      loginPage,
      appShell,
    }) => {
      await appShell.logout();
      await loginPage.expectLoaded();

      await page.goto('/');

      await loginPage.expectLoaded();
    });

    test('TC-AUTH-018 - Impedir volver al área autenticada después de logout', async ({
      page,
      loginPage,
      appShell,
    }) => {
      // Login y logout navegan con replace: sin esta página intermedia el
      // historial no tendría ninguna entrada autenticada a la cual volver.
      await page.goto('/mi-perfil');
      await appShell.logout();
      await loginPage.expectLoaded();

      // Vuelve a "/" (el dashboard)
      await page.goBack();

      await loginPage.expectLoaded();
      await expect(appShell.dashboardHeading).toBeHidden();
    });

    test('TC-AUTH-016 - Mantener sesión después de refrescar la página', async ({
      page,
      appShell,
    }) => {
      await page.reload();

      await appShell.expectDashboard();
      // El menú de usuario muestra el nombre del usuario autenticado
      await expect(appShell.userMenuButton).toBeVisible();
    });

    test(
      'TC-AUTH-017 - Acceder a Login con sesión activa',
      {
        annotation: {
          type: 'comportamiento-actual',
          description: 'Con sesión activa /login se muestra en vez de redirigir al dashboard.',
        },
      },
      async ({ loginPage }) => {
        await loginPage.goto();

        await loginPage.expectLoaded();
      },
    );
  });

  test('TC-AUTH-009 - Impedir acceso directo sin autenticación', async ({ page, loginPage }) => {
    await page.goto('/');

    await loginPage.expectLoaded();
  });
});
