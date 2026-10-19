import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { ChevronDown, Crown } from 'lucide-react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import EnvironmentChip from '../shared/components/common/EnvironmentChip';
import { brand } from '../shared/theme/palette';
import { adminLogout } from '../auth/admin-auth.api';
import { useAdminAuthStore } from '../auth/admin-auth.store';
import { ADMIN_SECTIONS } from '../sections';

/**
 * The Admin app's frame: its sections across the top and the signed-in
 * team member. Gates every page on a platform session (and on changing a
 * password the account is flagged to change).
 */
export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHydrated = useAdminAuthStore((s) => s.isHydrated);
  const user = useAdminAuthStore((s) => s.user);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  if (!isHydrated) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && location.pathname !== '/cambiar-contrasena') {
    return <Navigate to="/cambiar-contrasena" replace />;
  }

  const current = ADMIN_SECTIONS.find((s) =>
    s.path === '/' ? location.pathname === '/' : location.pathname.startsWith(s.path),
  )?.path;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 2, minHeight: { xs: 56 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: brand.gold }}>
            <Crown size={22} />
            <Typography sx={{ fontWeight: 800, color: 'text.primary', whiteSpace: 'nowrap' }}>Golden Bites · Admin</Typography>
          </Box>
          <EnvironmentChip />
          {!user.mustChangePassword && (
            <Tabs value={current ?? false} onChange={(_e, path: string) => navigate(path)} sx={{ flex: 1, minHeight: 56 }}>
              {ADMIN_SECTIONS.map((section) => (
                <Tab key={section.path} value={section.path} label={section.label} sx={{ minHeight: 56 }} />
              ))}
            </Tabs>
          )}
          <Button
            color="inherit"
            endIcon={<ChevronDown size={16} />}
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            sx={{ ml: 'auto', textTransform: 'none' }}
          >
            {user.firstName}
          </Button>
          <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {user.firstName} {user.lastName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                navigate('/cambiar-contrasena');
              }}
            >
              Cambiar contraseña
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                void adminLogout().then(() => navigate('/login', { replace: true }));
              }}
            >
              Salir
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1600, mx: 'auto' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
