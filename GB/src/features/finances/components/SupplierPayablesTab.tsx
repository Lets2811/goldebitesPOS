import { useState } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import DetailDrawer from '../../../components/common/DetailDrawer';
import EmptyState from '../../../components/common/EmptyState';
import ErrorState from '../../../components/common/ErrorState';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import StatusChip, { type StatusTone } from '../../../components/common/StatusChip';
import { Can } from '../../../modules/auth/components/can';
import {
  SUPPLIER_PAYABLE_STATUS_LABELS,
  SUPPLIER_PAYMENT_SOURCE_LABELS,
  expenseErrorMessage,
} from '../../../modules/finances/expense-payment-source';
import {
  useRecordSupplierPayment,
  useSupplierPayable,
  useSupplierPayables,
  useSupplierPayablesSummary,
} from '../../../modules/finances/hooks/use-supplier-payables';
import type { SupplierPayableStatus } from '../../../modules/finances/types/expense.types';
import type { SupplierPayable } from '../../../modules/finances/types/supplier-payable.types';
import { formatCOP } from '../../../utils/format';
import SupplierPaymentDialog from './SupplierPaymentDialog';

const STATUS_TONE: Record<SupplierPayableStatus, StatusTone> = {
  PENDING: 'warning',
  PARTIALLY_PAID: 'info',
  PAID: 'success',
  VOIDED: 'neutral',
};

const shortDate = (date: string) => dayjs(date).toDate().toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

/** "Vence hoy", "Vencida hace 3 días", "Vence el 30 oct 2026". */
function dueLabel(payable: SupplierPayable): { text: string; overdue: boolean } | null {
  if (!payable.dueDate || payable.status === 'PAID' || payable.status === 'VOIDED') return null;
  const days = dayjs(payable.dueDate).diff(dayjs().startOf('day'), 'day');
  if (days < 0) return { text: `Vencida hace ${-days} día${days === -1 ? '' : 's'}`, overdue: true };
  if (days === 0) return { text: 'Vence hoy', overdue: false };
  return { text: `Vence el ${shortDate(payable.dueDate)}`, overdue: false };
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'error' }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 200 }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, color: tone === 'error' ? 'error.main' : 'text.primary' }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function PayableDrawer({ payableId, onClose, onPay }: { payableId: string | null; onClose: () => void; onPay: (p: SupplierPayable) => void }) {
  const { data: payable } = useSupplierPayable(payableId);
  if (!payableId || !payable) return null;
  const open = payable.status === 'PENDING' || payable.status === 'PARTIALLY_PAID';
  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={payable.supplier.name}
      subtitle={`${payable.purchase.name ?? payable.purchase.description} · comprado el ${shortDate(payable.purchase.date)}`}
      headerExtra={<StatusChip label={SUPPLIER_PAYABLE_STATUS_LABELS[payable.status]} tone={STATUS_TONE[payable.status]} />}
      footer={
        open ? (
          <Can permission="finances.manage">
            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
              <Button variant="contained" onClick={() => onPay(payable)}>
                Registrar pago
              </Button>
            </Stack>
          </Can>
        ) : undefined
      }
    >
      <Stack spacing={2.5}>
        <Stack direction="row" spacing={3}>
          {[
            ['Total', payable.originalAmount],
            ['Pagado', payable.paidAmount],
            ['Debe', payable.pendingAmount],
          ].map(([label, amount]) => (
            <Box key={label as string}>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {formatCOP(amount as number)}
              </Typography>
            </Box>
          ))}
        </Stack>
        {payable.dueDate && (
          <Typography variant="body2" color="text.secondary">
            Vence el {shortDate(payable.dueDate)}
          </Typography>
        )}
        <Divider />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Pagos
        </Typography>
        {payable.payments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Aún no se le ha pagado nada.
          </Typography>
        ) : (
          <Stack divider={<Divider />}>
            {payable.payments.map((payment) => (
              <Stack key={payment.id} direction="row" spacing={2} sx={{ py: 1, alignItems: 'center' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {shortDate(payment.paymentDate)} · {SUPPLIER_PAYMENT_SOURCE_LABELS[payment.source]}
                  </Typography>
                  {payment.notes && (
                    <Typography variant="caption" color="text.secondary">
                      {payment.notes}
                    </Typography>
                  )}
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {formatCOP(payment.amount)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </DetailDrawer>
  );
}

/** Cuentas por pagar: lo que se les debe a los proveedores por compras a crédito, y sus pagos. */
export default function SupplierPayablesTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const { data: payables, isLoading, isError, refetch } = useSupplierPayables({ openOnly: filter === 'open' });
  const { data: summary } = useSupplierPayablesSummary();
  const recordPayment = useRecordSupplierPayment();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paying, setPaying] = useState<SupplierPayable | null>(null);

  return (
    <Stack spacing={2.5}>
      {summary && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Figure
            label={`Por pagar · ${summary.openCount} compra${summary.openCount === 1 ? '' : 's'}`}
            value={formatCOP(summary.pendingTotal)}
          />
          <Figure
            label={`Vencido · ${summary.overdueCount}`}
            value={formatCOP(summary.overdueTotal)}
            tone={summary.overdueTotal > 0 ? 'error' : undefined}
          />
        </Stack>
      )}

      <ToggleButtonGroup
        exclusive
        size="small"
        value={filter}
        onChange={(_, value: 'open' | 'all' | null) => value && setFilter(value)}
        sx={{ alignSelf: 'flex-start' }}
      >
        <ToggleButton value="open">Pendientes</ToggleButton>
        <ToggleButton value="all">Todas</ToggleButton>
      </ToggleButtonGroup>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <LoadingSkeleton variant="list" />
      ) : (payables ?? []).length === 0 ? (
        <EmptyState
          title={filter === 'open' ? 'No se le debe nada a ningún proveedor' : 'Aún no hay compras a crédito'}
          description='Registra una compra con "A crédito" o "Pago parcial" y aparece aquí.'
        />
      ) : (
        <Card variant="outlined">
          {(payables ?? []).map((payable, index) => {
            const due = dueLabel(payable);
            const open = payable.status === 'PENDING' || payable.status === 'PARTIALLY_PAID';
            return (
              <Stack
                key={payable.id}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                onClick={() => setSelectedId(payable.id)}
                sx={{
                  px: 2,
                  py: 1.5,
                  cursor: 'pointer',
                  alignItems: { sm: 'center' },
                  borderTop: index === 0 ? 'none' : '1px solid',
                  borderColor: 'divider',
                  '&:hover': { backgroundColor: 'action.hover' },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                    {payable.supplier.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {payable.purchase.name ?? payable.purchase.description} · {shortDate(payable.purchase.date)} · total{' '}
                    {formatCOP(payable.originalAmount)}
                    {payable.paidAmount > 0 ? ` · pagado ${formatCOP(payable.paidAmount)}` : ''}
                  </Typography>
                  {due && (
                    <Typography
                      variant="caption"
                      sx={{ display: 'block', color: due.overdue ? 'error.main' : 'text.secondary', fontWeight: due.overdue ? 700 : 400 }}
                    >
                      {due.text}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ textAlign: { sm: 'right' } }}>
                  <Typography variant="body1" sx={{ fontWeight: 800 }}>
                    {formatCOP(payable.pendingAmount)}
                  </Typography>
                  <StatusChip label={SUPPLIER_PAYABLE_STATUS_LABELS[payable.status]} tone={STATUS_TONE[payable.status]} />
                </Box>
                {open && (
                  <Can permission="finances.manage">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPaying(payable);
                      }}
                    >
                      Pagar
                    </Button>
                  </Can>
                )}
              </Stack>
            );
          })}
        </Card>
      )}

      <PayableDrawer
        payableId={selectedId}
        onClose={() => setSelectedId(null)}
        onPay={(payable) => {
          setSelectedId(null);
          setPaying(payable);
        }}
      />

      <SupplierPaymentDialog
        payable={paying}
        loading={recordPayment.isPending}
        onClose={() => setPaying(null)}
        onConfirm={(payment) => {
          if (!paying) return;
          recordPayment.mutate(
            { id: paying.id, payment },
            {
              onSuccess: () => {
                enqueueSnackbar('Pago registrado', { variant: 'success' });
                setPaying(null);
              },
              onError: (error) => enqueueSnackbar(expenseErrorMessage(error, payment.source), { variant: 'error' }),
            },
          );
        }}
      />
    </Stack>
  );
}
