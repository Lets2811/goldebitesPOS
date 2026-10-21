import { lazy, Suspense, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminChangePasswordPage from './auth/AdminChangePasswordPage';
import AdminLoginPage from './auth/AdminLoginPage';
import AdminLayout from './layout/AdminLayout';

const DashboardPage = lazy(() => import('./features/overview/pages/DashboardPage'));
const BusinessesPage = lazy(() => import('./features/overview/pages/BusinessesPage'));
const BusinessDetailPage = lazy(() => import('./features/overview/pages/BusinessDetailPage'));
const FeatureFlagsPage = lazy(() => import('./features/businesses/pages/FeatureFlagsPage'));
const TuraPage = lazy(() => import('./features/overview/pages/TuraPage'));
const EInvoicingPage = lazy(() => import('./features/overview/pages/EInvoicingPage'));
const AiCostsPage = lazy(() => import('./features/overview/pages/AiCostsPage'));

/** Every page of the Admin, by address; each loads when first opened. */
const PAGES: { path: string; Page: React.ComponentType }[] = [
  { path: '/', Page: DashboardPage },
  { path: '/empresas', Page: BusinessesPage },
  { path: '/empresas/:id', Page: BusinessDetailPage },
  { path: '/feature-flags', Page: FeatureFlagsPage },
  { path: '/tura', Page: TuraPage },
  { path: '/facturacion', Page: EInvoicingPage },
  { path: '/costos-ia', Page: AiCostsPage },
];

function Loadable({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      }
    >
      {children}
    </Suspense>
  );
}

export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route element={<AdminLayout />}>
        {PAGES.map(({ path, Page }) => (
          <Route
            key={path}
            path={path}
            element={
              <Loadable>
                <Page />
              </Loadable>
            }
          />
        ))}
        <Route path="/cambiar-contrasena" element={<AdminChangePasswordPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
