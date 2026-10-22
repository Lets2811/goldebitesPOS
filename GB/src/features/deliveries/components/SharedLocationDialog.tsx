import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation } from '@tanstack/react-query';
import { ClipboardPaste } from 'lucide-react';
import { normalizeApiError } from '../../../lib/api/api-error';
import { deliveriesApi } from '../../../modules/deliveries/api/deliveries.api';
import type { SharedLocation } from '../../../modules/deliveries/types/delivery.types';

/**
 * Places point B from a location the customer shared: in WhatsApp, press
 * the location message → Copy (or "Compartir" from Google Maps) and paste it
 * here. Also takes Google Maps / Waze links and plain coordinates.
 */
export default function SharedLocationDialog({
  open,
  onClose,
  onLocated,
}: {
  open: boolean;
  onClose: () => void;
  onLocated: (location: SharedLocation) => void;
}) {
  const [text, setText] = useState('');
  const resolve = useMutation({ mutationFn: (value: string) => deliveriesApi.resolveLocation(value) });

  const close = () => {
    setText('');
    resolve.reset();
    onClose();
  };

  const locate = (value: string) =>
    resolve.mutate(value, {
      onSuccess: (location) => {
        onLocated(location);
        close();
      },
    });

  async function pasteFromClipboard() {
    try {
      const value = (await navigator.clipboard.readText()).trim();
      if (value) {
        setText(value);
        locate(value);
      }
    } catch {
      // Clipboard reading blocked: the person pastes by hand (Ctrl+V).
    }
  }

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>Ubicación compartida por WhatsApp</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            En WhatsApp, mantén presionada la ubicación que te envió el cliente → <strong>Copiar</strong> (o ábrela en
            Google Maps → <strong>Compartir → Copiar enlace</strong>) y pégala aquí.
          </Typography>
          <TextField
            label="Enlace o coordenadas"
            placeholder="https://maps.google.com/?q=6.2442,-75.5812"
            value={text}
            onChange={(e) => setText(e.target.value)}
            multiline
            minRows={2}
            autoFocus
            error={resolve.isError}
            helperText={resolve.isError ? normalizeApiError(resolve.error).message : 'También sirven enlaces de Waze o coordenadas'}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text').trim();
              if (pasted) {
                e.preventDefault();
                setText(pasted);
                locate(pasted);
              }
            }}
          />
          {'clipboard' in navigator && 'readText' in navigator.clipboard && (
            <Button variant="outlined" startIcon={<ClipboardPaste size={16} />} onClick={() => void pasteFromClipboard()}>
              Pegar lo que copié
            </Button>
          )}
          <Alert severity="info" variant="outlined">
            La <strong>ubicación en tiempo real</strong> de WhatsApp no se puede copiar: pídele al cliente que envíe su{' '}
            <strong>ubicación actual</strong>.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancelar</Button>
        <Button variant="contained" disabled={!text.trim()} loading={resolve.isPending} onClick={() => locate(text)}>
          Ubicar en el mapa
        </Button>
      </DialogActions>
    </Dialog>
  );
}
