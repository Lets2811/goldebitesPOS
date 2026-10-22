import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  DEFAULT_LOCAL_API_URL,
  SERVER_CHOICE_KEY,
  SERVER_URLS,
  env,
  type ServerChoice,
  type ServerTarget,
} from '../../../config/env';
import { tokenStorage } from '../../../lib/api/token-storage';
import { useAuthStore } from '../store/auth.store';

const OPTIONS: { target: ServerTarget; label: string; hint: string }[] = [
  { target: 'local', label: 'Local', hint: 'Tu computador, en el mismo Wi-Fi' },
  { target: 'staging', label: 'Staging', hint: SERVER_URLS.staging },
  { target: 'production', label: 'Producción', hint: SERVER_URLS.production },
];

/**
 * Talks to another server from now on, on this phone. Each server has its
 * own users, so the session ends; the app starts again with the new one.
 */
function chooseServer(choice: ServerChoice): void {
  try {
    localStorage.setItem(SERVER_CHOICE_KEY, JSON.stringify(choice));
  } catch {
    return;
  }
  tokenStorage.clearRefreshToken();
  useAuthStore.getState().clearSession();
  window.location.replace('/');
}

/**
 * Which server the phone app talks to: local, staging or production. Hidden
 * on the sign-in screen (three taps on the Midas Tech logo), for testing.
 */
export default function ServerPickerDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const current = env.serverTarget ?? 'staging';
  const [target, setTarget] = useState<ServerTarget>(current);
  const [localUrl, setLocalUrl] = useState(
    current === 'local' ? env.apiBaseUrl : DEFAULT_LOCAL_API_URL,
  );

  const url = target === 'local' ? localUrl.trim().replace(/\/+$/, '') : SERVER_URLS[target];
  const localUrlValid = /^https?:\/\/[^/\s]+/.test(url);
  const unchanged = target === current && url === env.apiBaseUrl;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 800 }}>Servidor de la app</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Ahora: <strong>{env.apiBaseUrl}</strong>
        </Typography>
        <RadioGroup value={target} onChange={(e) => setTarget(e.target.value as ServerTarget)}>
          {OPTIONS.map((option) => (
            <FormControlLabel
              key={option.target}
              value={option.target}
              control={<Radio />}
              label={
                <>
                  <Typography sx={{ fontWeight: 700 }}>{option.label}</Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ wordBreak: 'break-all' }}
                  >
                    {option.hint}
                  </Typography>
                </>
              }
              sx={{ alignItems: 'flex-start', mb: 1, '& .MuiRadio-root': { pt: 0.5 } }}
            />
          ))}
        </RadioGroup>
        {target === 'local' && (
          <TextField
            label="Dirección del servidor local"
            value={localUrl}
            onChange={(e) => setLocalUrl(e.target.value)}
            error={!localUrlValid}
            helperText={
              localUrlValid
                ? 'GB-BE corriendo en tu computador (npm run start:dev), puerto 3000.'
                : 'Escribe la dirección completa, ej. http://192.168.1.10:3000/api/v1'
            }
            fullWidth
            size="small"
            sx={{ mt: 1 }}
            slotProps={{
              htmlInput: { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false },
            }}
          />
        )}
        {!unchanged && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Se cerrará la sesión: cada servidor tiene sus propios usuarios.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={unchanged || !localUrlValid}
          onClick={() => chooseServer({ target, url })}
        >
          Conectar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
