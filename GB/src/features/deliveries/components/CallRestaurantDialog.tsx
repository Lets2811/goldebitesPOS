import { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

interface CallRestaurantDialogProps {
  open: boolean;
  /** Common reasons, one tap each. */
  reasons: string[];
  loading?: boolean;
  onClose: () => void;
  onCall: (reason: string | undefined) => void;
}

/**
 * "Llamar al restaurante": the alert sounds on the restaurant's screens until
 * someone attends it. The reason is optional, so calling is never blocked by it.
 */
export default function CallRestaurantDialog({ open, reasons, loading, onClose, onCall }: CallRestaurantDialogProps) {
  const [reason, setReason] = useState('');

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Llamar al restaurante</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Le avisaremos al restaurante en su pantalla para que revise tu domicilio. Cuéntales qué pasa (opcional):
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
            {reasons.map((option) => (
              <Chip
                key={option}
                label={option}
                color={reason === option ? 'primary' : 'default'}
                variant={reason === option ? 'filled' : 'outlined'}
                onClick={() => setReason(reason === option ? '' : option)}
              />
            ))}
          </Stack>
          <TextField
            size="small"
            label="Otro motivo"
            value={reasons.includes(reason) ? '' : reason}
            onChange={(e) => setReason(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" color="warning" loading={loading} onClick={() => onCall(reason.trim() || undefined)}>
          Llamar ahora
        </Button>
      </DialogActions>
    </Dialog>
  );
}
