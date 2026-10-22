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

/** Admin de plataforma (is_platform_admin): gestiona todos los negocios. */
export const platformAdminUser = {
  email: required('E2E_PLATFORM_ADMIN_EMAIL'),
  password: required('E2E_PLATFORM_ADMIN_PASSWORD'),
};
