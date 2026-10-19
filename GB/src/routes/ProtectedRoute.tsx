import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { usePermissions } from '../modules/auth/hooks/use-permissions';
import { KIOSK_PATHS } from './kioskConfig';

interface ProtectedRouteProps {
  /** Permiso(s) requeridos del catálogo real del backend. Un array significa "cualquiera de estos". */
  permission: string | string[];
  /** Clave del módulo activable (ver FEATURE_MODULES en el backend); si se omite, no se exige ninguna feature. */
  module?: string;
}

export default function ProtectedRoute({ permission, module }: ProtectedRouteProps) {
  const { hasPermission, hasAnyPermission, hasFeature } = usePermissions();
  const location = useLocation();

  const allowed =
    (Array.isArray(permission) ? hasAnyPermission(permission) : hasPermission(permission)) &&
    (module ? hasFeature(module) : true);

  if (!allowed) {
    // A courier has no back office: anything they cannot open takes them to their app
    // (e.g. the installed app opening "/").
    if (hasPermission('deliveries.deliver') && !hasPermission('dashboard.read')) {
      return <Navigate to={KIOSK_PATHS.courier} replace />;
    }
    return <Navigate to="/sin-acceso" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
