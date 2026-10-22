import { Suspense, lazy, type ReactElement } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { ShieldAlert } from 'lucide-react';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import EmptyState from '../components/common/EmptyState';
import MidasCredit from '../components/common/MidasCredit';
import ProtectedRoute from './ProtectedRoute';
import AuthProtectedRoute from '../modules/auth/components/protected-route';
import { usePermissions } from '../modules/auth/hooks/use-permissions';
import { useAllBranchesReview } from '../modules/auth/hooks/use-branch-mode';
import { useLogout } from '../modules/auth/hooks/use-logout';
import type { PhoneApp } from '../config/env';
import { KIOSK_PATHS, KIOSK_PERMISSIONS } from './kioskConfig';

const LoginPage = lazy(() => import('../modules/auth/pages/LoginPage'));
const ForcePasswordChangePage = lazy(() => import('../modules/auth/pages/ForcePasswordChangePage'));
const WaiterKioskPage = lazy(() => import('../features/kiosk-waiter/pages/WaiterKioskPage'));
const CourierAppPage = lazy(() => import('../features/deliveries/courier/CourierAppPage'));

function Loadable({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingSkeleton variant="page" />}>{children}</Suspense>;
}

type Permissions = ReturnType<typeof usePermissions>;

interface PhoneAppScreen {
  path: string;
  /** The same gate as the screen has in the whole POS (AppRoutes). */
  guard: ReactElement;
  page: ReactElement;
  canUse: (permissions: Permissions, reviewOnly: boolean) => boolean;
  cannotUse: { title: string; description: string };
}

/** The one screen of each phone app. */
const SCREENS: Record<PhoneApp, PhoneAppScreen> = {
  waiter: {
    path: KIOSK_PATHS.waiter,
    guard: <ProtectedRoute operational permission={KIOSK_PERMISSIONS.waiter} />,
    page: <WaiterKioskPage />,
    // "Todas las sedes" is for review: orders are taken at a branch.
    canUse: ({ hasAnyPermission }, reviewOnly) =>
      !reviewOnly && hasAnyPermission(KIOSK_PERMISSIONS.waiter),
    cannotUse: {
      title: 'Este usuario no puede tomar pedidos',
      description:
        'La app de mesero es para tomar pedidos en una sede. Ingresa con un usuario de mesero, o elige una sede si administras varias.',
    },
  },
  courier: {
    path: KIOSK_PATHS.courier,
    guard: <ProtectedRoute permission="deliveries.deliver" module="deliveries" />,
    page: <CourierAppPage />,
    canUse: ({ hasPermission, hasFeature }) =>
      hasPermission('deliveries.deliver') && hasFeature('deliveries'),
    cannotUse: {
      title: 'Este usuario no es domiciliario',
      description:
        'La app de domicilios es para los domiciliarios del negocio. Ingresa con tu usuario de domiciliario, o pide que activen Domicilios en el negocio.',
    },
  },
};

/**
 * Who opened the app and cannot use it here. The app has nothing else to
 * show, so the way out is to sign in with another user.
 */
function CannotUse({ screen }: { screen: PhoneAppScreen }) {
  const navigate = useNavigate();
  const logout = useLogout();
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        px: 2,
      }}
    >
      <Stack sx={{ alignItems: 'center' }}>
        <EmptyState
          icon={ShieldAlert}
          title={screen.cannotUse.title}
          description={screen.cannotUse.description}
        />
        <Button
          variant="contained"
          sx={{ mt: -2 }}
          disabled={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
          }
        >
          Cambiar de usuario
        </Button>
      </Stack>
      <MidasCredit />
    </Box>
  );
}

/** The app's start: its screen, for whoever can use it here. */
function Start({ screen }: { screen: PhoneAppScreen }) {
  const permissions = usePermissions();
  const reviewOnly = useAllBranchesReview();
  if (!screen.canUse(permissions, reviewOnly)) return <CannotUse screen={screen} />;
  return <Navigate to={screen.path} replace />;
}

/**
 * The routes of a phone app (the POS built with VITE_APP_SHELL, see
 * capacitor.config.ts): signing in and the app's one screen, nothing of the
 * back office. Any other address leads to the start.
 */
export default function PhoneAppRoutes({ app }: { app: PhoneApp }) {
  const screen = SCREENS[app];
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Loadable>
            <LoginPage />
          </Loadable>
        }
      />
      <Route element={<AuthProtectedRoute />}>
        <Route
          path="/cambiar-contrasena"
          element={
            <Loadable>
              <ForcePasswordChangePage />
            </Loadable>
          }
        />
        <Route element={screen.guard}>
          <Route path={screen.path} element={<Loadable>{screen.page}</Loadable>} />
        </Route>
        <Route path="/sin-acceso" element={<CannotUse screen={screen} />} />
        <Route path="*" element={<Start screen={screen} />} />
      </Route>
    </Routes>
  );
}
