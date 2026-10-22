import type { Page, Route } from '@playwright/test';

/**
 * Patrones de la API (GB-BE). Terminan en el endpoint exacto, así que no
 * chocan con las rutas del frontend (/login) ni con los módulos de Vite.
 */
export const API = {
  login: '**/auth/login',
  refresh: '**/auth/refresh',
  changePassword: '**/auth/change-password',
};

/**
 * Marca la sesión como "debe cambiar contraseña" sin tocar la base de datos:
 * deja pasar la respuesta real y solo cambia el flag del usuario. También
 * parchea /auth/refresh, porque el refresh reemplaza el usuario de la sesión.
 */
export async function forceMustChangePassword(page: Page) {
  const patch = async (route: Route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (body?.data?.user) {
      body.data.user.mustChangePassword = true;
    }
    await route.fulfill({ response, json: body });
  };

  await page.route(API.login, patch);
  await page.route(API.refresh, patch);
}

/**
 * Simula un negocio con varias sedes: la base local tiene una sola, así que
 * el backend nunca pide elegir sede. Solo se marca la respuesta del login;
 * al elegir sede, /auth/switch-branch (real) entrega la sesión ya resuelta.
 */
export async function forceBranchSelection(page: Page) {
  await page.route(API.login, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (body?.data?.user) {
      body.data.user.branchSelectionRequired = true;
    }
    await route.fulfill({ response, json: body });
  });
}

/**
 * Retiene la petición hasta llamar a `release()`, para poder inspeccionar
 * la UI mientras la petición está en curso.
 */
export async function holdRequest(page: Page, url: string) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));

  await page.route(url, async (route) => {
    await released;
    await route.continue();
  });

  return { release };
}
