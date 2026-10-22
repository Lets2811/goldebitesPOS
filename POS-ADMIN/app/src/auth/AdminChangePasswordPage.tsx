import { useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { normalizeApiError } from '../shared/lib/api/api-error';
import { useAdminChangePassword } from './admin-auth.api';
import { useAdminAuthStore } from './admin-auth.store';

const MIN_LENGTH = 10;

/** Change the Admin account's password; required when the account is flagged to. */
export default function AdminChangePasswordPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const forced = useAdminAuthStore((s) => s.user?.mustChangePassword ?? false);
  const change = useAdminChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const mismatch = confirm !== '' && confirm !== next;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (next.length < MIN_LENGTH || mismatch) return;
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          enqueueSnackbar('Contraseña actualizada. Las demás sesiones se cerraron.', { variant: 'success' });
          navigate('/', { replace: true });
        },
      },
    );
  }

  return (
    <Box sx={{ minHeight: forced ? '100vh' : undefined, display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper component="form" onSubmit={submit} sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <Stack spacing={2.25}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Cambiar contraseña
          </Typography>
          {forced && <Alert severity="warning">Debes cambiar tu contraseña antes de continuar.</Alert>}
          {change.isError && <Alert severity="error">{normalizeApiError(change.error).message}</Alert>}
          <TextField
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
          <TextField
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            helperText={`Mínimo ${MIN_LENGTH} caracteres`}
            error={next !== '' && next.length < MIN_LENGTH}
            required
          />
          <TextField
            label="Repite la nueva contraseña"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={mismatch}
            helperText={mismatch ? 'No coincide' : undefined}
            required
          />
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            {!forced && <Button onClick={() => navigate(-1)}>Cancelar</Button>}
            <Button type="submit" variant="contained" loading={change.isPending} disabled={mismatch || next.length < MIN_LENGTH}>
              Guardar
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
