/**
 * Datos de prueba leídos del entorno (archivo `.env.e2e` o variables de CI).
 * Ver `.env.e2e.example`.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copia .env.e2e.example a .env.e2e y complétala.`,
    );
  }
  return value;
}

export const adminUser = {
  email: required('E2E_ADMIN_EMAIL'),
  password: required('E2E_ADMIN_PASSWORD'),
  fullName: required('E2E_ADMIN_NAME'),
};

/** URL de la API (GB-BE), para preparar datos de prueba. */
export const apiURL = process.env.E2E_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * Cajero de prueba (rol CASHIER). No viene en el seed: lo crea la suite por
 * API la primera vez (ver test-users.ts).
 */
export const cashierUser = {
  email: required('E2E_CASHIER_EMAIL'),
  password: required('E2E_CASHIER_PASSWORD'),
  firstName: 'Cajero',
  lastName: 'E2E',
  roleName: 'CASHIER',
  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  },
};

/** Cocinero de prueba (rol KITCHEN). También lo crea la suite por API. */
export const kitchenUser = {
  email: required('E2E_KITCHEN_EMAIL'),
  password: required('E2E_KITCHEN_PASSWORD'),
  firstName: 'Cocina',
  lastName: 'E2E',
  roleName: 'KITCHEN',
};

/**
 * Cuenta de plataforma del seed. Desde la migración 088 usa la app Admin
 * aparte: en el POS su cuenta está inactiva (ver TC-AUTH-038).
 */
export const platformAdminUser = {
  email: required('E2E_PLATFORM_ADMIN_EMAIL'),
  password: required('E2E_PLATFORM_ADMIN_PASSWORD'),
};
