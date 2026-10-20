import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import { useSnackbar } from 'notistack';
import { useChangePassword } from '../hooks/use-change-password';
import { useLogout } from '../hooks/use-logout';
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from '../schemas/change-password.schema';
import { normalizeApiError } from '../../../lib/api/api-error';
import { brand } from '../../../theme/palette';

/**
 * Reached automatically (see ProtectedRoute) whenever the session's
 * mustChangePassword flag is set — a new/reset employee account can't do
 * anything else until they set their own password. Changing it revokes
 * every refresh token for this user on the backend, so success sends them
 * back through /login with their new password rather than trying to keep
 * the now half-dead session alive.
 */
export default function ForcePasswordChangePage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const changePassword = useChangePassword();
  const logout = useLogout();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = (values: ChangePasswordFormValues) => {
    changePassword.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          enqueueSnackbar('Contraseña actualizada. Inicia sesión de nuevo.', {
            variant: 'success',
          });
          navigate('/login', { replace: true });
        },
      },
    );
  };

  const apiError = changePassword.error ? normalizeApiError(changePassword.error) : null;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: brand.black,
        px: 2,
      }}
    >
      <Paper sx={{ p: 4, width: '100%', maxWidth: 420 }} elevation={4}>
        <Stack spacing={3} component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.gold }}>
              Cambia tu contraseña
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Por seguridad, debes definir tu propia contraseña antes de continuar.
            </Typography>
          </Box>

          {apiError && <Alert severity="error">{apiError.message}</Alert>}

          <TextField
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            autoFocus
            fullWidth
            {...register('currentPassword')}
            error={Boolean(errors.currentPassword)}
            helperText={errors.currentPassword?.message}
          />

          <TextField
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            fullWidth
            {...register('newPassword')}
            error={Boolean(errors.newPassword)}
            helperText={errors.newPassword?.message}
          />

          <TextField
            label="Confirmar nueva contraseña"
            type="password"
            autoComplete="new-password"
            fullWidth
            {...register('confirmPassword')}
            error={Boolean(errors.confirmPassword)}
            helperText={errors.confirmPassword?.message}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={changePassword.isPending}
          >
            {changePassword.isPending ? 'Guardando...' : 'Guardar y continuar'}
          </Button>

          <Typography variant="body2" sx={{ textAlign: 'center' }}>
            <Link component="button" type="button" onClick={() => logout.mutate()}>
              Cerrar sesión
            </Link>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
