/** Sesión del admin guardada por `auth.setup.ts` y reutilizada por los tests autenticados. */
export const ADMIN_STORAGE_STATE = 'playwright/.auth/admin.json';

/** Para los tests que deben empezar sin sesión (p. ej. los de Login). */
export const NO_SESSION = { cookies: [], origins: [] };
