import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CurrencyField from '../../../components/common/CurrencyField';
import { useBranches } from '../../../modules/branches/hooks/use-branches';
import { useCashSessions } from '../../../modules/cash-sessions/hooks/use-cash-sessions';
import { SUPPLIER_PAYMENT_SOURCE_LABELS } from '../../../modules/finances/expense-payment-source';
import type { SupplierPaymentInput, SupplierPaymentSource } from '../../../modules/finances/types/expense.types';
import type { SupplierPayable } from '../../../modules/finances/types/supplier-payable.types';
import { formatCOP, formatTimeCO } from '../../../utils/format';

interface SupplierPaymentDialogProps {
  payable: SupplierPayable | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (payment: SupplierPaymentInput) => void;
}

/** Pagarle a un proveedor una compra a crédito, todo lo que se debe o una parte, desde la caja, la reserva o el banco. */
export default function SupplierPaymentDialog({ payable, loading, onClose, onConfirm }: SupplierPaymentDialogProps) {
  const [amount, setAmount] = useState<number | ''>('');
  const [source, setSource] = useState<SupplierPaymentSource | ''>('');
  const [paymentDate, setPaymentDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [cashSessionId, setCashSessionId] = useState('');
  const [notes, setNotes] = useState('');
  const [trackedId, setTrackedId] = useState<string | null>(null);

  // Cada cuenta abre con todo lo que se debe propuesto; la fuente se elige a propósito.
  if (payable && payable.id !== trackedId) {
    setTrackedId(payable.id);
    setAmount(payable.pendingAmount);
    setSource('');
    setPaymentDate(dayjs().format('YYYY-MM-DD'));
    setCashSessionId('');
    setNotes('');
  }

  const { data: sessionPage } = useCashSessions({ status: 'OPEN', limit: 20 });
  const openSessions = useMemo(() => sessionPage?.data ?? [], [sessionPage]);
  const { data: branchPage } = useBranches({ isActive: true, limit: 50 });
  const branchName = useMemo(() => new Map((branchPage?.data ?? []).map((b) => [b.id, b.name])), [branchPage]);

  const fromCash = source === 'CASH_OPERATIONAL';
  const needsSession = fromCash && openSessions.length > 1;
  const value = typeof amount === 'number' ? amount : 0;
  const tooMuch = payable ? Math.round(value * 100) > Math.round(payable.pendingAmount * 100) : false;
  const valid =
    value > 0 && !tooMuch && source !== '' && (!needsSession || cashSessionId !== '') && (!fromCash || openSessions.length > 0);

  return (
    <Dialog open={Boolean(payable)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Pagar a {payable?.supplier.name}</DialogTitle>
      <DialogContent>
        {payable && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {payable.purchase.name ?? payable.purchase.description}: debe {formatCOP(payable.pendingAmount)} de{' '}
            {formatCOP(payable.originalAmount)}.
          </Typography>
        )}
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <CurrencyField
            label="Cantidad a pagar"
            value={amount}
            onChange={setAmount}
            error={tooMuch}
            helperText={tooMuch ? 'Es más de lo que se debe' : 'Puede ser una parte de lo que se debe.'}
            fullWidth
          />
          <TextField
            select
            label="Pagado desde"
            value={source}
            onChange={(e) => setSource(e.target.value as SupplierPaymentSource)}
            fullWidth
          >
            {(Object.keys(SUPPLIER_PAYMENT_SOURCE_LABELS) as SupplierPaymentSource[]).map((option) => (
              <MenuItem key={option} value={option}>
                {SUPPLIER_PAYMENT_SOURCE_LABELS[option]}
              </MenuItem>
            ))}
          </TextField>
          {fromCash && openSessions.length === 0 && (
            <Alert severity="warning">No hay ninguna caja abierta. Abre la caja o paga desde otra fuente.</Alert>
          )}
          {needsSession && (
            <TextField
              select
              label="Caja"
              value={cashSessionId}
              onChange={(e) => setCashSessionId(e.target.value)}
              helperText="Hay varias cajas abiertas: elige de cuál sale."
              fullWidth
            >
              {openSessions.map((session) => (
                <MenuItem key={session.id} value={session.id}>
                  {branchName.get(session.branchId) ?? 'Caja'} · abierta {formatTimeCO(session.openedAt)}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Fecha del pago"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            helperText="Ese día cuenta como gasto."
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <TextField label="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={!valid}
          loading={loading}
          onClick={() =>
            onConfirm({
              amount: value,
              source: source as SupplierPaymentSource,
              paymentDate,
              cashSessionId: needsSession ? cashSessionId : undefined,
              notes: notes.trim() || undefined,
            })
          }
        >
          Registrar pago
        </Button>
      </DialogActions>
    </Dialog>
  );
}
