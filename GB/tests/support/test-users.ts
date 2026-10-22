import type { APIRequestContext } from '@playwright/test';
import { adminUser, apiURL } from './env';

type TestUser = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  /** Rol de sistema (CASHIER, KITCHEN...). */
  roleName: string;
};

type ApiUser = { id: string; email: string };
type ApiRole = { id: string; name: string };

export async function apiLogin(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${apiURL}/auth/login`, { data: { email, password } });
  if (!response.ok()) {
    throw new Error(`Login de ${email} falló por API: ${response.status()}`);
  }
  const body = await response.json();
  return body.data.accessToken as string;
}

/** Módulos activos del negocio, tal como viajan en el token del usuario. */
export async function enabledFeatures(request: APIRequestContext, email: string, password: string) {
  const token = await apiLogin(request, email, password);
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  return payload.enabledFeatures as string[];
}

/**
 * Crea el usuario de prueba en el negocio del admin si todavía no existe.
 * Es idempotente: si ya existe, no lo toca (se asume que nadie cambió su
 * contraseña a mano).
 */
export async function ensureTestUser(request: APIRequestContext, user: TestUser) {
  const token = await apiLogin(request, adminUser.email, adminUser.password);
  const headers = { Authorization: `Bearer ${token}` };

  const users: ApiUser[] = (await (await request.get(`${apiURL}/users`, { headers })).json()).data;
  if (users.some((u) => u.email === user.email)) {
    return;
  }

  const roles: ApiRole[] = (await (await request.get(`${apiURL}/roles`, { headers })).json()).data;
  const role = roles.find((r) => r.name === user.roleName);
  if (!role) {
    throw new Error(`No existe el rol ${user.roleName} en el negocio del admin`);
  }

  // Misma sede que el admin, para que vea los mismos datos
  const me = (await (await request.get(`${apiURL}/users/me`, { headers })).json()).data;

  const response = await request.post(`${apiURL}/users`, {
    headers,
    data: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: user.password,
      roleId: role.id,
      branchId: me.branchId ?? undefined,
    },
  });
  if (!response.ok()) {
    throw new Error(`No se pudo crear ${user.email}: ${response.status()} ${await response.text()}`);
  }
}
