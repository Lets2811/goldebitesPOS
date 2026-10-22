/** Sesión del admin guardada por `auth.setup.ts` y reutilizada por los tests autenticados. */
export const ADMIN_STORAGE_STATE = 'playwright/.auth/admin.json';

/** Sesión del cajero de prueba (rol CASHIER), para los tests de permisos. */
export const CASHIER_STORAGE_STATE = 'playwright/.auth/cashier.json';

/** Para los tests que deben empezar sin sesión (p. ej. los de Login). */
export const NO_SESSION = { cookies: [], origins: [] };
