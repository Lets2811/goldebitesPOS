import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import { Copy, Check } from 'lucide-react';

interface CredentialsRevealDialogProps {
  open: boolean;
  email?: string | null;
  temporaryPassword: string | null;
  onClose: () => void;
}

export default function CredentialsRevealDialog({
  open,
  email,
  temporaryPassword,
  onClose,
}: CredentialsRevealDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!temporaryPassword) return;
    await navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Contraseña temporal generada</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="warning">
            Esta contraseña solo se muestra una vez. Compártela con el empleado de forma segura — no
            quedará visible después de cerrar este mensaje.
          </Alert>
          {email && (
            <Typography variant="body2" color="text.secondary">
              Usuario: <strong>{email}</strong>
            </Typography>
          )}
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1.25,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 0.5 }}>
              {temporaryPassword}
            </Typography>
            <IconButton size="small" onClick={handleCopy} aria-label="Copiar contraseña">
              {copied ? <Check size={16} color="#4CAF6D" /> : <Copy size={16} />}
            </IconButton>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} variant="contained">
          Entendido, cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
