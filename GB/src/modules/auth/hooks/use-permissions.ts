import { useMemo } from 'react';
import { useAuthStore } from '../store/auth.store';
import { decodeAccessToken } from '../utils/decode-access-token';

/**
 * Core modules every business always has — not part of the toggleable
 * feature catalog. "roles" (roles y permisos + usuarios) is intentionally
 * NOT core: it's a sellable module like any other, see FEATURE_MODULES on
 * the backend.
 */
const CORE_MODULES = new Set(['dashboard', 'settings']);

/**
 * Real, backend-driven permission checks (codes from the JWT, e.g.
 * "products.read"). Distinct from the legacy src/hooks/usePermissions.ts,
 * which gates sidebar navigation by a coarse role→module mapping — see
 * INTEGRATION_STATUS.md for why the two haven't been reconciled yet.
 */
export function usePermissions() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const decoded = useMemo(() => {
    if (!accessToken) return null;
    return decodeAccessToken(accessToken);
  }, [accessToken]);

  const permissions = decoded?.permissions ?? [];
  const enabledFeatures = decoded?.enabledFeatures ?? [];

  return {
    permissions,
    hasPermission: (permission: string) => permissions.includes(permission),
    hasAnyPermission: (perms: string[]) => perms.some((p) => permissions.includes(p)),
    hasAllPermissions: (perms: string[]) => perms.every((p) => permissions.includes(p)),
    enabledFeatures,
    /** True for core modules (always on) or when the business has this feature module enabled. */
    hasFeature: (module: string) => CORE_MODULES.has(module) || enabledFeatures.includes(module),
  };
}
