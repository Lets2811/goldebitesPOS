import { useMemo, useState } from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import type { ColumnDef } from '@tanstack/react-table';
import { useSnackbar } from 'notistack';
import { Wallet, PlusCircle, Lock, Banknote, CreditCard, Landmark, Smartphone, HandCoins, ReceiptText, RotateCcw } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import DataTable from '../../../components/common/DataTable';
import StatusChip from '../../../components/common/StatusChip';
import DateDisplay from '../../../components/common/DateDisplay';
import CurrencyDisplay from '../../../components/common/CurrencyDisplay';
import EmptyState from '../../../components/common/EmptyState';
import ErrorState from '../../../components/common/ErrorState';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import { Can } from '../../../modules/auth/components/can';
import { HasFeature } from '../../../modules/auth/components/has-feature';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useCurrentCashSession } from '../../../modules/cash-sessions/hooks/use-current-cash-session';
import { useCashSessions } from '../../../modules/cash-sessions/hooks/use-cash-sessions';
import { useOpenCashSession } from '../../../modules/cash-sessions/hooks/use-open-cash-session';
import { useCloseCashSession } from '../../../modules/cash-sessions/hooks/use-close-cash-session';
import { useAddCashMovement } from '../../../modules/cash-sessions/hooks/use-add-cash-movement';
import { useReopenCashSession } from '../../../modules/cash-sessions/hooks/use-reopen-cash-session';
import { normalizeApiError } from '../../../lib/api/api-error';
import { formatCOP } from '../../../utils/format';
import { PAYMENT_METHOD_LABELS } from '../../../modules/orders/order-status';
import type { PaymentMethod } from '../../../modules/orders/types/payment.types';
import type {
  CashMovement,
  CashMovementType,
  CashSession,
} from '../../../modules/cash-sessions/types/cash-session.types';
import OpenSessionDialog from '../components/OpenSessionDialog';
import CloseSessionDialog from '../components/CloseSessionDialog';
import CashMovementDrawer from '../components/CashMovementDrawer';
import ReopenSessionDialog from '../components/ReopenSessionDialog';
import RectifyingSessionCard from '../components/RectifyingSessionCard';

const MOVEMENT_TYPE_LABELS: Record<CashMovementType, string> = {
  OPENING: 'Apertura',
  SALE: 'Venta',
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
  WITHDRAWAL: 'Retiro',
  CLOSING: 'Cierre',
  REIMBURSEMENT: 'Reembolso',
  EXPENSE_REVERSAL: 'Reversión de gasto',
  INCOME_REVERSAL: 'Anulación de ingreso',
};

const POSITIVE_MOVEMENT_TYPES: CashMovementType[] = ['OPENING', 'SALE', 'INCOME', 'EXPENSE_REVERSAL'];

const PAYMENT_METHOD_ICONS: Record<PaymentMethod, typeof Banknote> = {
  CASH: Banknote,
  CARD: CreditCard,
  TRANSFER: Landmark,
  NEQUI: Smartphone,
  DAVIPLATA: Smartphone,
  OTHER: HandCoins,
};

export default function CashRegisterPage() {
  const { enqueueSnackbar } = useSnackbar();
  const branchId = useAuthStore((s) => s.user?.branchId ?? null);

  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeTargetId, setCloseTargetId] = useState<string | null>(null);
  const [movementTargetId, setMovementTargetId] = useState<string | null>(null);
  const [reopenTargetId, setReopenTargetId] = useState<string | null>(null);

  const {
    data: currentSession,
    isLoading,
    isError,
    hasNoOpenSession,
    refetch,
  } = useCurrentCashSession(branchId);
  const { data: historyData } = useCashSessions({ limit: 20, status: 'CLOSED' });
  const { data: rectifyingData } = useCashSessions({ limit: 5, status: 'RECTIFYING' });
  const openSession = useOpenCashSession();
  const closeSession = useCloseCashSession();
  const addMovement = useAddCashMovement(branchId);
  const reopenSession = useReopenCashSession();

  const closedSessions = historyData?.data ?? [];
  const rectifyingSessions = rectifyingData?.data ?? [];

  const sales = useMemo(
    () => (currentSession?.movements ?? []).filter((m) => m.movementType === 'SALE'),
    [currentSession],
  );
  const salesByPaymentMethod = useMemo(() => {
    const totals = {} as Record<PaymentMethod, number>;
    for (const sale of sales) {
      if (!sale.paymentMethod) continue;
      totals[sale.paymentMethod] = (totals[sale.paymentMethod] ?? 0) + sale.amount;
    }
    return (Object.entries(totals) as [PaymentMethod, number][]).filter(([, total]) => total > 0);
  }, [sales]);
  const manualMovements = useMemo(
    () =>
      (currentSession?.movements ?? []).filter((m) =>
        (['INCOME', 'EXPENSE', 'WITHDRAWAL'] as CashMovementType[]).includes(m.movementType),
      ),
    [currentSession],
  );

  const movementColumns: ColumnDef<CashMovement, unknown>[] = [
    {
      id: 'createdAt',
      header: 'Fecha',
      cell: ({ row }) => <DateDisplay value={row.original.createdAt} mode="datetime" variant="body2" />,
    },
    {
      id: 'type',
      header: 'Tipo',
      cell: ({ row }) => (
        <StatusChip
          label={MOVEMENT_TYPE_LABELS[row.original.movementType]}
          tone={POSITIVE_MOVEMENT_TYPES.includes(row.original.movementType) ? 'success' : 'warning'}
        />
      ),
    },
    { accessorKey: 'description', header: 'Descripción', cell: ({ row }) => row.original.description ?? '—' },
    {
      accessorKey: 'amount',
      header: 'Monto',
      cell: ({ row }) => (
        <CurrencyDisplay
          value={POSITIVE_MOVEMENT_TYPES.includes(row.original.movementType) ? row.original.amount : -row.original.amount}
          variant="body2"
          sx={{ fontWeight: 700 }}
        />
      ),
    },
  ];

  const historyColumns: ColumnDef<CashSession, unknown>[] = [
    {
      id: 'openedAt',
      header: 'Apertura',
      cell: ({ row }) => <DateDisplay value={row.original.openedAt} mode="datetime" variant="body2" />,
    },
    {
      id: 'closedAt',
      header: 'Cierre',
      cell: ({ row }) => (row.original.closedAt ? <DateDisplay value={row.original.closedAt} mode="datetime" variant="body2" /> : '—'),
    },
    { accessorKey: 'openingAmount', header: 'Base inicial', cell: ({ getValue }) => formatCOP(getValue<number>()) },
    {
      id: 'actualClosingAmount',
      header: 'Efectivo contado',
      cell: ({ row }) =>
        row.original.actualClosingAmount !== null ? formatCOP(row.original.actualClosingAmount) : '—',
    },
    {
      id: 'differenceAmount',
      header: 'Diferencia efectivo',
      cell: ({ row }) =>
        row.original.differenceAmount !== null ? (
          <Typography
            variant="body2"
            color={row.original.differenceAmount === 0 ? 'success.main' : 'error.main'}
            sx={{ fontWeight: 700 }}
          >
            {formatCOP(row.original.differenceAmount)}
          </Typography>
        ) : (
          '—'
        ),
    },
    {
      id: 'actualTransferAmount',
      header: 'Transferencias verificadas',
      cell: ({ row }) =>
        row.original.actualTransferAmount !== null ? formatCOP(row.original.actualTransferAmount) : '—',
    },
    {
      id: 'transferDifferenceAmount',
      header: 'Diferencia transferencias',
      cell: ({ row }) =>
        row.original.transferDifferenceAmount !== null ? (
          <Typography
            variant="body2"
            color={row.original.transferDifferenceAmount === 0 ? 'success.main' : 'error.main'}
            sx={{ fontWeight: 700 }}
          >
            {formatCOP(row.original.transferDifferenceAmount)}
          </Typography>
        ) : (
          '—'
        ),
    },
    {
      id: 'rectify',
      header: '',
      cell: ({ row }) => (
        <HasFeature feature="cash-register.rectification">
          <Can permission="cash.reopen">
            <Button
              size="small"
              color="warning"
              startIcon={<RotateCcw size={14} />}
              onClick={() => setReopenTargetId(row.original.id)}
            >
              Rectificar
            </Button>
          </Can>
        </HasFeature>
      ),
    },
  ];

  if (!branchId) {
    return (
      <>
        <PageHeader title="Caja" breadcrumbs={[{ label: 'Caja' }]} />
        <EmptyState
          icon={Wallet}
          title="Tu usuario no tiene una sucursal asignada"
          description="Contacta a un administrador para asignarte una sucursal y poder operar la caja."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Caja"
        subtitle="Apertura, movimientos y cuadre de caja por turno."
        breadcrumbs={[{ label: 'Caja' }]}
        actions={
          currentSession ? (
            <Can permission="cash.close">
              <Button
                variant="outlined"
                startIcon={<PlusCircle size={16} />}
                onClick={() => setMovementTargetId(currentSession.id)}
              >
                Registrar movimiento
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<Lock size={16} />}
                onClick={() => setCloseTargetId(currentSession.id)}
              >
                Cerrar caja
              </Button>
            </Can>
          ) : (
            <Can permission="cash.open">
              <Button variant="contained" startIcon={<Wallet size={16} />} onClick={() => setOpenDialogOpen(true)}>
                Abrir caja
              </Button>
            </Can>
          )
        }
      />

      {rectifyingSessions.map((session) => (
        <RectifyingSessionCard
          key={session.id}
          session={session}
          movementColumns={movementColumns}
          onAddMovement={() => setMovementTargetId(session.id)}
          onCloseCorrection={() => setCloseTargetId(session.id)}
        />
      ))}

      {isLoading ? (
        <LoadingSkeleton variant="page" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : hasNoOpenSession || !currentSession ? (
        <EmptyState
          icon={Wallet}
          title="La caja está cerrada"
          description="Abre un nuevo turno registrando la base inicial para comenzar a operar."
          actionLabel="Abrir caja"
          onAction={() => setOpenDialogOpen(true)}
        />
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard label="Base inicial" value={formatCOP(currentSession.openingAmount)} icon={Wallet} />
            </Grid>
            {salesByPaymentMethod.map(([paymentMethod, total]) => (
              <Grid key={paymentMethod} size={{ xs: 12, sm: 6, md: 3 }}>
                <StatCard
                  label={`Ventas en ${PAYMENT_METHOD_LABELS[paymentMethod]}`}
                  value={formatCOP(total)}
                  icon={PAYMENT_METHOD_ICONS[paymentMethod]}
                />
              </Grid>
            ))}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                label="Ventas del turno"
                value={String(sales.length)}
                icon={ReceiptText}
                helperText="Total de pagos registrados"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard label="Movimientos manuales" value={String(manualMovements.length)} icon={PlusCircle} />
            </Grid>
          </Grid>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <StatusChip label="Caja abierta" tone="success" />
              </Stack>
              <Typography variant="body2" color="text.secondary" component="div">
                Abierta el{' '}
                <DateDisplay
                  value={currentSession.openedAt}
                  mode="datetime"
                  component="span"
                  sx={{ fontWeight: 600 }}
                />
              </Typography>
            </CardContent>
          </Card>

          <Box sx={{ mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Movimientos del turno actual
            </Typography>
          </Box>
          <DataTable
            columns={movementColumns}
            data={currentSession.movements}
            emptyTitle="Sin movimientos registrados"
            emptyDescription="Los ingresos, egresos y retiros del turno aparecerán aquí."
            pageSize={8}
          />
        </>
      )}

      <Box sx={{ mt: 4 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          Historial de sesiones
        </Typography>
        <DataTable
          columns={historyColumns}
          data={closedSessions}
          emptyTitle="Aún no hay sesiones cerradas"
          emptyDescription="El historial de cierres de caja aparecerá aquí."
          pageSize={8}
        />
      </Box>

      <OpenSessionDialog
        open={openDialogOpen}
        loading={openSession.isPending}
        onClose={() => setOpenDialogOpen(false)}
        onConfirm={(amount) => {
          openSession.mutate(
            { branchId, openingAmount: amount },
            {
              onSuccess: () => {
                setOpenDialogOpen(false);
                enqueueSnackbar('Caja abierta correctamente', { variant: 'success' });
              },
              onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
            },
          );
        }}
      />

      <CloseSessionDialog
        open={Boolean(closeTargetId)}
        loading={closeSession.isPending}
        onClose={() => setCloseTargetId(null)}
        onConfirm={(actualClosingAmount, actualTransferAmount, notes) => {
          if (!closeTargetId) return;
          closeSession.mutate(
            {
              id: closeTargetId,
              payload: { actualClosingAmount, actualTransferAmount, notes: notes || undefined },
            },
            {
              onSuccess: (closed) => {
                setCloseTargetId(null);
                const diff = closed.differenceAmount ?? 0;
                const transferDiff = closed.transferDifferenceAmount;
                const messages = [
                  diff === 0
                    ? 'Efectivo: cuadre exacto.'
                    : `Efectivo: diferencia de ${formatCOP(Math.abs(diff))} (${diff > 0 ? 'sobrante' : 'faltante'}).`,
                ];
                if (transferDiff !== null) {
                  messages.push(
                    transferDiff === 0
                      ? 'Transferencias: cuadre exacto.'
                      : `Transferencias: diferencia de ${formatCOP(Math.abs(transferDiff))} (${transferDiff > 0 ? 'sobrante' : 'faltante'}).`,
                  );
                }
                enqueueSnackbar(`Caja cerrada. ${messages.join(' ')}`, {
                  variant: diff === 0 && (transferDiff === null || transferDiff === 0) ? 'success' : 'warning',
                });
              },
              onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
            },
          );
        }}
      />

      <ReopenSessionDialog
        open={Boolean(reopenTargetId)}
        loading={reopenSession.isPending}
        onClose={() => setReopenTargetId(null)}
        onConfirm={(masterKey, reason) => {
          if (!reopenTargetId) return;
          reopenSession.mutate(
            { id: reopenTargetId, payload: { masterKey, reason } },
            {
              onSuccess: () => {
                setReopenTargetId(null);
                enqueueSnackbar('Caja reabierta para corrección', { variant: 'success' });
              },
              onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
            },
          );
        }}
      />

      <CashMovementDrawer
        open={Boolean(movementTargetId)}
        loading={addMovement.isPending}
        onClose={() => setMovementTargetId(null)}
        onSubmit={(values) => {
          if (!movementTargetId) return;
          addMovement.mutate(
            { id: movementTargetId, payload: values },
            {
              onSuccess: () => {
                setMovementTargetId(null);
                enqueueSnackbar('Movimiento registrado correctamente', { variant: 'success' });
              },
              onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
            },
          );
        }}
      />
    </>
  );
}
