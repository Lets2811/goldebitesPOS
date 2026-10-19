import { useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Crown } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import EnvironmentChip from '../shared/components/common/EnvironmentChip';
import { normalizeApiError } from '../shared/lib/api/api-error';
import { brand } from '../shared/theme/palette';
import { useAdminLogin } from './admin-auth.api';
import { useAdminAuthStore } from './admin-auth.store';

/** Sign-in of the Admin app: Golden Bites team accounts only (not restaurant users). */
export default function AdminLoginPage() {
  const navigate = useNavigate();
  const login = useAdminLogin();
  const signedIn = useAdminAuthStore((s) => s.accessToken !== null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (signedIn) return <Navigate to="/" replace />;

  function submit(event: FormEvent) {
    event.preventDefault();
    login.mutate(
      { email: email.trim(), password },
      { onSuccess: (session) => navigate(session.user.mustChangePassword ? '/cambiar-contrasena' : '/', { replace: true }) },
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, bgcolor: 'background.default' }}>
      <Paper component="form" onSubmit={submit} sx={{ p: 4, width: '100%', maxWidth: 400 }}>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box sx={{ color: brand.gold, display: 'flex' }}>
              <Crown size={28} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                Golden Bites · Admin
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Administración de la plataforma
              </Typography>
            </Box>
            <Box sx={{ ml: 'auto' }}>
              <EnvironmentChip />
            </Box>
          </Stack>
          {login.isError && <Alert severity="error">{normalizeApiError(login.error).message}</Alert>}
          <TextField
            label="Correo"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <TextField
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="contained" size="large" loading={login.isPending}>
            Entrar
          </Button>
          <Typography variant="caption" color="text.secondary">
            Solo para el equipo de Golden Bites. Los restaurantes entran por su POS.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
