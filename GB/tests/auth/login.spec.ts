import { test, expect } from '@playwright/test';

test.describe('AUTH - Login', () => {

  test('TC-AUTH-001 - Mostrar pantalla de Login', async ({ page }) => {

    await page.goto('/login');

    await expect(page).toHaveURL(/\/login/);

    await expect(
      page.getByRole('textbox', { name: 'Correo electrónico' })
    ).toBeVisible();

    await expect(
      page.getByRole('textbox', { name: 'Contraseña' })
    ).toBeVisible();

    await expect(
      page.getByRole('button', { name: 'Ingresar' })
    ).toBeVisible();

  });

  test('TC-AUTH-002 - Correo electrónico obligatorio', async ({ page }) => {

    await page.goto('/login');

    await page
      .getByRole('textbox', { name: 'Contraseña' })
      .fill('Password123');

    await page
      .getByRole('button', { name: 'Ingresar' })
      .click();

    await expect(
      page.getByText('Ingresa tu correo')
    ).toBeVisible();

    await expect(page).toHaveURL(/\/login/);

  });

});

test('TC-AUTH-003 - Contraseña obligatoria', async ({ page }) => {

  // Paso 1: acceder al Login
  await page.goto('/login');

  // Paso 2: ingresar un correo con formato válido
  await page
    .getByRole('textbox', { name: 'Correo electrónico' })
    .fill('usuario@prueba.com');

  // Paso 3: dejar la contraseña vacía

  // Paso 4: intentar iniciar sesión
  await page
    .getByRole('button', { name: 'Ingresar' })
    .click();

  // Resultado esperado:
  // Se muestra la validación de contraseña obligatoria
  await expect(
    page.getByText('Ingresa tu contraseña')
  ).toBeVisible();

  // El usuario permanece en Login
  await expect(page).toHaveURL(/\/login/);

});

test('TC-AUTH-004 - Formato de correo electrónico inválido', async ({ page }) => {

  // Paso 1: acceder al Login
  await page.goto('/login');

  // Paso 2: ingresar un correo con formato inválido
  await page
    .getByRole('textbox', { name: 'Correo electrónico' })
    .fill('SDAD');

  // Paso 3: ingresar una contraseña
  await page
    .getByRole('textbox', { name: 'Contraseña' })
    .fill('Password123');

  // Paso 4: intentar iniciar sesión
  await page
    .getByRole('button', { name: 'Ingresar' })
    .click();

  // Resultado esperado:
  // Se muestra la validación de formato de correo
  await expect(
    page.getByText('Ingresa un correo válido')
  ).toBeVisible();

  // El usuario debe permanecer en Login
  await expect(page).toHaveURL(/\/login/);

});

test('TC-AUTH-005 - Credenciales incorrectas', async ({ page }) => {

  // Paso 1: acceder al Login
  await page.goto('/login');

  // Paso 2: ingresar un correo con formato válido pero inexistente
  await page
    .getByRole('textbox', { name: 'Correo electrónico' })
    .fill('usuario.inexistente@prueba.com');

  // Paso 3: ingresar una contraseña
  await page
    .getByRole('textbox', { name: 'Contraseña' })
    .fill('Password123');

  // Paso 4: intentar iniciar sesión
  await page
    .getByRole('button', { name: 'Ingresar' })
    .click();

  // Resultado esperado:
  // El sistema rechaza las credenciales
  await expect(
    page.getByText('Correo o contraseña incorrectos.')
  ).toBeVisible();

  // El usuario permanece en Login
  await expect(page).toHaveURL(/\/login/);

});

test('TC-AUTH-006 - Inicio de sesión exitoso', async ({ page }) => {

  // Paso 1: acceder al Login
  await page.goto('/login');

  // Paso 2: ingresar credenciales válidas
  await page
    .getByRole('textbox', { name: 'Correo electrónico' })
    .fill('admin@goldenbites.local');

  await page
    .getByRole('textbox', { name: 'Contraseña' })
    .fill('ChangeMe123!');

  // Paso 3: iniciar sesión
  await page
    .getByRole('button', { name: 'Ingresar' })
    .click();

  // Resultado esperado 1:
  // El usuario abandona la pantalla de Login
  await expect(page).toHaveURL('/');

  // Resultado esperado 2:
  // Se carga correctamente el área autenticada
  await expect(
    page.getByRole('heading', { name: 'Centro de operaciones' })
  ).toBeVisible();

  // Resultado esperado 3:
  // Se muestra el usuario autenticado
  await expect(
    page.getByText('Admin Golden Bites', { exact: true })
  ).toBeVisible();

});

test('TC-AUTH-007 - Cerrar sesión', async ({ page }) => {

  // Paso 1: iniciar sesión
  await page.goto('/login');

  await page
    .getByRole('textbox', { name: 'Correo electrónico' })
    .fill('admin@goldenbites.local');

  await page
    .getByRole('textbox', { name: 'Contraseña' })
    .fill('ChangeMe123!');

  await page
    .getByRole('button', { name: 'Ingresar' })
    .click();

  // Confirmar que el login fue exitoso
  await expect(
    page.getByRole('heading', { name: 'Centro de operaciones' })
  ).toBeVisible();

  // Paso 2: abrir menú del usuario
  await page
    .getByText('Admin Golden Bites', { exact: true })
    .click();

  // Paso 3: cerrar sesión
  await page
    .getByText('Cerrar sesión', { exact: true })
    .click();

  // Resultado esperado:
  // El usuario vuelve al Login
  await expect(page).toHaveURL(/\/login/);

  await expect(
    page.getByRole('button', { name: 'Ingresar' })
  ).toBeVisible();

});

test('TC-AUTH-008 - Impedir acceso después de cerrar sesión', async ({ page }) => {

  // Paso 1: iniciar sesión
  await page.goto('/login');

  await page
    .getByRole('textbox', { name: 'Correo electrónico' })
    .fill('admin@goldenbites.local');

  await page
    .getByRole('textbox', { name: 'Contraseña' })
    .fill('ChangeMe123!');

  await page
    .getByRole('button', { name: 'Ingresar' })
    .click();

  await expect(
    page.getByRole('heading', { name: 'Centro de operaciones' })
  ).toBeVisible();

  // Paso 2: cerrar sesión
  await page
    .getByText('Admin Golden Bites', { exact: true })
    .click();

  await page
    .getByText('Cerrar sesión', { exact: true })
    .click();

  await expect(page).toHaveURL(/\/login/);

  // Paso 3: intentar acceder nuevamente a una ruta protegida
  await page.goto('/');

  // Resultado esperado:
  // El sistema no permite acceder sin una sesión válida
  // y redirecciona nuevamente al Login
  await expect(page).toHaveURL(/\/login/);

  await expect(
    page.getByRole('button', { name: 'Ingresar' })
  ).toBeVisible();

});

test('TC-AUTH-009 - Impedir acceso directo sin autenticación', async ({ page }) => {

  // Precondición:
  // Playwright inicia este test en un contexto nuevo sin sesión autenticada

  // Paso 1: intentar acceder directamente al área protegida
  await page.goto('/');

  // Resultado esperado:
  // El sistema redirecciona al Login
  await expect(page).toHaveURL(/\/login/);

  // Confirmar que realmente cargó la pantalla de Login
  await expect(
    page.getByRole('textbox', { name: 'Correo electrónico' })
  ).toBeVisible();

  await expect(
    page.getByRole('button', { name: 'Ingresar' })
  ).toBeVisible();

});

test('TC-AUTH-010 - Correo y contraseña obligatorios', async ({ page }) => {

  // Paso 1: acceder al Login
  await page.goto('/login');

  // Paso 2: no ingresar correo ni contraseña

  // Paso 3: intentar iniciar sesión
  await page
    .getByRole('button', { name: 'Ingresar' })
    .click();

  // Resultado esperado:
  // Se muestran ambas validaciones
  await expect(
    page.getByText('Ingresa tu correo')
  ).toBeVisible();

  await expect(
    page.getByText('Ingresa tu contraseña')
  ).toBeVisible();

  // El usuario permanece en Login
  await expect(page).toHaveURL(/\/login/);

});

test('TC-AUTH-011 - Login con espacios al inicio y final del correo', async ({ page }) => {

  // Paso 1: acceder al Login
  await page.goto('/login');

  // Paso 2: ingresar correo válido con espacios
  await page
    .getByRole('textbox', { name: 'Correo electrónico' })
    .fill('   admin@goldenbites.local   ');

  // Paso 3: ingresar contraseña válida
  await page
    .getByRole('textbox', { name: 'Contraseña' })
    .fill('ChangeMe123!');

  // Paso 4: iniciar sesión
  await page
    .getByRole('button', { name: 'Ingresar' })
    .click();

  // Resultado esperado:
  // Los espacios no impiden la autenticación
  await expect(page).toHaveURL('/');

  await expect(
    page.getByRole('heading', { name: 'Centro de operaciones' })
  ).toBeVisible();

});

test('TC-AUTH-012 - Login con correo en mayúsculas', async ({ page }) => {

  // Paso 1: acceder al Login
  await page.goto('/login');

  // Paso 2: ingresar el correo existente completamente en mayúsculas
  await page
    .getByRole('textbox', { name: 'Correo electrónico' })
    .fill('ADMIN@GOLDENBITES.LOCAL');

  // Paso 3: ingresar la contraseña válida
  await page
    .getByRole('textbox', { name: 'Contraseña' })
    .fill('ChangeMe123!');

  // Paso 4: intentar iniciar sesión
  await page
    .getByRole('button', { name: 'Ingresar' })
    .click();

  // Resultado esperado según comportamiento actual:
  // Las credenciales son rechazadas
  await expect(
    page.getByText('Correo o contraseña incorrectos.')
  ).toBeVisible();

  // El usuario permanece en Login
  await expect(page).toHaveURL(/\/login/);

});

test('TC-AUTH-013 - Contraseña incorrecta para usuario existente', async ({ page }) => {

  // Paso 1: acceder al Login
  await page.goto('/login');

  // Paso 2: ingresar un correo existente
  await page
    .getByRole('textbox', { name: 'Correo electrónico' })
    .fill('admin@goldenbites.local');

  // Paso 3: ingresar una contraseña incorrecta
  await page
    .getByRole('textbox', { name: 'Contraseña' })
    .fill('PasswordIncorrecto123!');

  // Paso 4: intentar iniciar sesión
  await page
    .getByRole('button', { name: 'Ingresar' })
    .click();

  // Resultado esperado:
  // El sistema rechaza las credenciales sin revelar
  // si el correo corresponde a una cuenta existente
  await expect(
    page.getByText('Correo o contraseña incorrectos.')
  ).toBeVisible();

  // El usuario permanece en Login
  await expect(page).toHaveURL(/\/login/);

});

test('TC-AUTH-014 - Iniciar sesión presionando Enter', async ({ page }) => {

  // Paso 1: acceder al Login
  await page.goto('/login');

  // Paso 2: ingresar credenciales válidas
  await page
    .getByRole('textbox', { name: 'Correo electrónico' })
    .fill('admin@goldenbites.local');

  const passwordInput = page.getByRole('textbox', {
    name: 'Contraseña'
  });

  await passwordInput.fill('ChangeMe123!');

  // Paso 3: enviar el formulario mediante teclado
  await passwordInput.press('Enter');

  // Resultado esperado:
  // El usuario inicia sesión sin necesidad de hacer clic en "Ingresar"
  await expect(page).toHaveURL('/');

  await expect(
    page.getByRole('heading', { name: 'Centro de operaciones' })
  ).toBeVisible();

});

test('TC-AUTH-015 - Campo contraseña enmascarado', async ({ page }) => {

  // Paso 1: acceder al Login
  await page.goto('/login');

  // Paso 2: localizar el campo contraseña
  const passwordInput = page.getByRole('textbox', {
    name: 'Contraseña'
  });

  // Resultado esperado:
  // El campo utiliza un input de tipo password
  await expect(passwordInput).toHaveAttribute('type', 'password');

  // Paso 3: ingresar una contraseña
  await passwordInput.fill('Password123');

  // El valor existe en el campo pero continúa siendo de tipo password
  await expect(passwordInput).toHaveValue('Password123');
  await expect(passwordInput).toHaveAttribute('type', 'password');

});

test('TC-AUTH-016 - Mantener sesión después de refrescar la página', async ({ page }) => {

  // Paso 1: iniciar sesión
  await page.goto('/login');

  await page
    .getByRole('textbox', { name: 'Correo electrónico' })
    .fill('admin@goldenbites.local');

  await page
    .getByRole('textbox', { name: 'Contraseña' })
    .fill('ChangeMe123!');

  await page
    .getByRole('button', { name: 'Ingresar' })
    .click();

  // Confirmar autenticación
  await expect(page).toHaveURL('/');

  await expect(
    page.getByRole('heading', { name: 'Centro de operaciones' })
  ).toBeVisible();

  // Paso 2: refrescar la aplicación
  await page.reload();

  // Resultado esperado:
  // La sesión continúa activa
  await expect(page).toHaveURL('/');

  await expect(
    page.getByRole('heading', { name: 'Centro de operaciones' })
  ).toBeVisible();

  // Confirmar que sigue siendo el mismo usuario autenticado
  await expect(
    page.getByText('Admin Golden Bites', { exact: true })
  ).toBeVisible();

});

test('TC-AUTH-017 - Acceder a Login con sesión activa', async ({ page }) => {

  // Paso 1: iniciar sesión
  await page.goto('/login');

  await page
    .getByRole('textbox', { name: 'Correo electrónico' })
    .fill('admin@goldenbites.local');

  await page
    .getByRole('textbox', { name: 'Contraseña' })
    .fill('ChangeMe123!');

  await page
    .getByRole('button', { name: 'Ingresar' })
    .click();

  await expect(page).toHaveURL('/');

  await expect(
    page.getByRole('heading', { name: 'Centro de operaciones' })
  ).toBeVisible();

  // Paso 2: navegar manualmente a Login manteniendo la sesión
  await page.goto('/login');

  // Comportamiento actual:
  // La aplicación permite mostrar Login aunque exista una sesión activa
  await expect(page).toHaveURL(/\/login/);

  await expect(
    page.getByRole('textbox', { name: 'Correo electrónico' })
  ).toBeVisible();

  await expect(
    page.getByRole('button', { name: 'Ingresar' })
  ).toBeVisible();

});

test('TC-AUTH-018 - Impedir volver al área autenticada después de logout', async ({ page }) => {

  // Paso 1: iniciar sesión
  await page.goto('/login');

  await page
    .getByRole('textbox', { name: 'Correo electrónico' })
    .fill('admin@goldenbites.local');

  await page
    .getByRole('textbox', { name: 'Contraseña' })
    .fill('ChangeMe123!');

  await page
    .getByRole('button', { name: 'Ingresar' })
    .click();

  await expect(page).toHaveURL('/');

  await expect(
    page.getByRole('heading', { name: 'Centro de operaciones' })
  ).toBeVisible();

  // Paso 2: cerrar sesión
  await page
    .getByText('Admin Golden Bites', { exact: true })
    .click();

  await page
    .getByText('Cerrar sesión', { exact: true })
    .click();

  await expect(page).toHaveURL(/\/login/);

  // Paso 3: intentar regresar mediante el historial
  await page.goBack();

  // Resultado esperado:
  // El historial no debe restaurar contenido autenticado
  await expect(
    page.getByRole('heading', { name: 'Centro de operaciones' })
  ).not.toBeVisible();

});