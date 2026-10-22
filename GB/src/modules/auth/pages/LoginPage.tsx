import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { useLogin } from '../hooks/use-login';
import { loginSchema, type LoginFormValues } from '../schemas/login.schema';
import { normalizeApiError } from '../../../lib/api/api-error';
import { decodeAccessToken } from '../utils/decode-access-token';
import { brand } from '../../../theme/palette';
import { FORCE_PASSWORD_CHANGE_PATH } from '../components/protected-route';
import EnvironmentChip from '../../../components/common/EnvironmentChip';
import { KIOSK_PATHS } from '../../../routes/kioskConfig';
import MidasCredit from '../../../components/common/MidasCredit';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  // A stale "from" can point at the forced-password-change route (e.g. a
  // race with the auth-gate's own redirect while the session was being
  // cleared mid-change) — never treat it as a valid post-login destination;
  // ProtectedRoute re-derives whether that screen is actually still needed.
  const rawRedirect = (location.state as { from?: string } | null)?.from ?? '/';
  const redirectTo = rawRedirect === FORCE_PASSWORD_CHANGE_PATH ? '/' : rawRedirect;

  const onSubmit = (values: LoginFormValues) => {
    login.mutate(values, {
      onSuccess: (data) => {
        const decoded = decodeAccessToken(data.accessToken);
        // A courier has no back office: their place is the courier app.
        const permissions = decoded?.permissions ?? [];
        const isCourierOnly =
          permissions.includes('deliveries.deliver') &&
          !permissions.includes('dashboard.read') &&
          redirectTo === '/';
        navigate(isCourierOnly ? KIOSK_PATHS.courier : redirectTo, { replace: true });
      },
    });
  };

  const apiError = login.error ? normalizeApiError(login.error) : null;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 2,
        bgcolor: brand.black,
        px: 2,
      }}
    >
      <Paper sx={{ p: 4, width: '100%', maxWidth: 400 }} elevation={4}>
        <Stack spacing={3} component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Box sx={{ textAlign: 'center' }}>
            <EnvironmentChip />
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.gold }}>
              Golden Bites
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Inicia sesión para continuar
            </Typography>
          </Box>

          {apiError && <Alert severity="error">{apiError.message}</Alert>}

          <TextField
            label="Correo electrónico"
            type="email"
            autoComplete="email"
            autoFocus
            fullWidth
            {...register('email')}
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
          />

          <TextField
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            fullWidth
            {...register('password')}
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={login.isPending}
          >
            {login.isPending ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </Stack>
      </Paper>
      <MidasCredit />
    </Box>
  );
}
