import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { describeIncomeDestination } from '../../../modules/finances/other-income-labels';
import type { OtherIncome } from '../../../modules/finances/types/other-income.types';
import { formatCOP } from '../../../utils/format';

interface VoidIncomeDialogProps {
  income: OtherIncome | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/** Anular un ingreso saca el dinero de donde entró; el ingreso queda en la lista, marcado como anulado. */
export default function VoidIncomeDialog({ income, loading, onClose, onConfirm }: VoidIncomeDialogProps) {
  const [reason, setReason] = useState('');
  const [trackedId, setTrackedId] = useState<string | null>(null);
  if (income && income.id !== trackedId) {
    setTrackedId(income.id);
    setReason('');
  }
  const valid = reason.trim().length >= 3;

  return (
    <Dialog open={Boolean(income)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Anular ingreso</DialogTitle>
      <DialogContent>
        {income && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Se retiran {formatCOP(income.amount)} de: {describeIncomeDestination(income.destination, income.paymentMethod).toLowerCase()}.
            El ingreso queda en la lista, marcado como anulado.
          </Typography>
        )}
        <TextField
          label="Motivo"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej. se registró dos veces"
          multiline
          minRows={2}
          fullWidth
          autoFocus
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button color="error" variant="contained" disabled={!valid} loading={loading} onClick={() => onConfirm(reason.trim())}>
          Anular
        </Button>
      </DialogActions>
    </Dialog>
  );
}
