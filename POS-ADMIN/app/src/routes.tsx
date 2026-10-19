import { lazy, Suspense, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminChangePasswordPage from './auth/AdminChangePasswordPage';
import AdminLoginPage from './auth/AdminLoginPage';
import AdminLayout from './layout/AdminLayout';

const BusinessesPage = lazy(() => import('./features/businesses/pages/PlatformAdminPage'));
const FeatureFlagsPage = lazy(() => import('./features/businesses/pages/FeatureFlagsPage'));

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
        <Route
          path="/"
          element={
            <Loadable>
              <BusinessesPage />
            </Loadable>
          }
        />
        <Route
          path="/feature-flags"
          element={
            <Loadable>
              <FeatureFlagsPage />
            </Loadable>
          }
        />
        <Route path="/cambiar-contrasena" element={<AdminChangePasswordPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
