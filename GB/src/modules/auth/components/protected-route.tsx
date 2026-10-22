import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import BranchPickerPage from '../pages/BranchPickerPage';

export const FORCE_PASSWORD_CHANGE_PATH = '/cambiar-contrasena';

/** Gates the whole app on session state. Module/permission-level gating happens separately. */
export default function ProtectedRoute() {
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const mustChangePassword = useAuthStore((s) => s.user?.mustChangePassword);
  const branchSelectionRequired = useAuthStore((s) => s.user?.branchSelectionRequired);
  const location = useLocation();

  if (!isHydrated) {
    return (
      <Box
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (mustChangePassword && location.pathname !== FORCE_PASSWORD_CHANGE_PATH) {
    return <Navigate to={FORCE_PASSWORD_CHANGE_PATH} replace />;
  }

  // A stale redirect (e.g. a race with the auth-gate's own !isAuthenticated
  // redirect while the session is being cleared mid-change) can land a user
  // here after mustChangePassword has already gone false — leave instead of
  // showing the form again.
  if (!mustChangePassword && location.pathname === FORCE_PASSWORD_CHANGE_PATH) {
    return <Navigate to="/" replace />;
  }

  // Nothing of the app mounts until the branch is picked: no screen loads
  // data that is not yet the branch's (and the API would refuse it).
  if (branchSelectionRequired && !mustChangePassword) {
    return <BranchPickerPage />;
  }

  return <Outlet />;
}
