import { useState } from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { useSnackbar } from 'notistack';
import { Landmark, PiggyBank, type LucideIcon } from 'lucide-react';
import FormDrawer from '../../../components/common/FormDrawer';
import CurrencyField from '../../../components/common/CurrencyField';
import DateDisplay from '../../../components/common/DateDisplay';
import StatusChip from '../../../components/common/StatusChip';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import { Can } from '../../../modules/auth/components/can';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useBranches } from '../../../modules/branches/hooks/use-branches';
import { useFundBalance, useInitializeFund } from '../../../modules/funds/hooks/use-funds';
import type { FundBalance, FundType } from '../../../modules/funds/types/fund.types';
import { normalizeApiError } from '../../../lib/api/api-error';
import { formatCOP } from '../../../utils/format';
import { brand } from '../../../theme/palette';

const FUND_INFO: Record<
  FundType,
  { label: string; description: string; icon: LucideIcon; notesHint: string }
> = {
  CASH_RESERVE: {
    label: 'Reserva de efectivo',
    description: 'Efectivo guardado fuera de la caja del turno.',
    icon: PiggyBank,
    notesHint: 'Ej.: conteo del efectivo en la caja fuerte.',
  },
  BANK_ACCOUNT: {
    label: 'Cuenta bancaria',
    description: 'Saldo de la cuenta del negocio. Es una sola para todo el negocio.',
    icon: Landmark,
    notesHint: 'Ej.: saldo según el extracto del banco.',
  },
};

/** Los rechazos del backend al configurar un fondo llegan en inglés. */
const INITIALIZE_ERROR_MESSAGES: Record<string, string> = {
  OPEN_CASH_SESSION:
    'Hay una caja abierta. Ciérrala antes de configurar la reserva, para no contar dos veces el mismo efectivo.',
  FUND_ALREADY_INITIALIZED: 'Este fondo ya tiene un saldo inicial configurado.',
  INVALID_AMOUNT: 'El saldo inicial debe ser mayor que cero.',
  BRANCH_REQUIRED: 'Selecciona la sede de la reserva.',
};

function FundCard({
  fundType,
  fund,
  loading,
  failed,
  onInitialize,
}: {
  fundType: FundType;
  fund: FundBalance | undefined;
  loading: boolean;
  failed: boolean;
  onInitialize: () => void;
}) {
  const info = FUND_INFO[fundType];
  const Icon = info.icon;
  const initialized = Boolean(fund?.initializedAt);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
              <Icon size={20} color={brand.gold} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {info.label}
              </Typography>
            </Stack>
            {fund && (
              <StatusChip
                label={initialized ? 'Configurado' : 'Sin configurar'}
                tone={initialized ? 'success' : 'neutral'}
              />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {info.description}
          </Typography>

          {loading ? (
            <LoadingSkeleton variant="list" />
          ) : failed || !fund ? (
            <Typography variant="body2" color="error">
              No se pudo consultar este fondo.
            </Typography>
          ) : initialized ? (
            <>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {formatCOP(fund.balance)}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Saldo disponible · configurado el
                </Typography>
                <DateDisplay value={fund.initializedAt as string} variant="caption" />
              </Stack>
            </>
          ) : (
            <>
              <Typography variant="body2">
                Aún no tiene saldo inicial, así que no se puede usar para pagar gastos.
              </Typography>
              <Can permission="finances.manage">
                <Button variant="contained" onClick={onInitialize} sx={{ alignSelf: 'flex-start' }}>
                  Configurar saldo inicial
                </Button>
              </Can>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function FundsTab() {
  const { enqueueSnackbar } = useSnackbar();
  const userBranchId = useAuthStore((s) => s.user?.branchId ?? null);
  const { data: branchesData, isLoading: branchesLoading } = useBranches({
    isActive: true,
    limit: 50,
  });
  const branches = branchesData?.data ?? [];

  // La reserva es por sede. Con una sola sede no hay nada que elegir.
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const branchId =
    selectedBranchId ??
    branches.find((branch) => branch.id === userBranchId)?.id ??
    branches[0]?.id ??
    undefined;

  const reserve = useFundBalance('CASH_RESERVE', branchId, !branchesLoading);
  const bank = useFundBalance('BANK_ACCOUNT');
  const initializeFund = useInitializeFund();

  const [initializing, setInitializing] = useState<FundType | null>(null);
  const [amount, setAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  function openInitialize(fundType: FundType) {
    setAmount('');
    setNotes('');
    setInitializing(fundType);
  }

  const canSubmit = typeof amount === 'number' && amount > 0 && notes.trim().length > 0;

  function handleInitialize() {
    if (!initializing || !canSubmit) return;
    initializeFund.mutate(
      {
        fundType: initializing,
        payload: { amount: amount as number, notes: notes.trim(), branchId },
      },
      {
        onSuccess: () => {
          enqueueSnackbar(`${FUND_INFO[initializing].label}: saldo inicial configurado`, {
            variant: 'success',
          });
          setInitializing(null);
        },
        onError: (error) => {
          const normalized = normalizeApiError(error);
          enqueueSnackbar(
            (normalized.code && INITIALIZE_ERROR_MESSAGES[normalized.code]) || normalized.message,
            {
              variant: 'error',
            },
          );
        },
      },
    );
  }

  return (
    <>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Los fondos son el dinero del negocio fuera de la caja del turno. Cada gasto que se
          registra como pagado con uno de ellos se descuenta de su saldo.
        </Typography>

        {branches.length > 1 && (
          <TextField
            select
            size="small"
            label="Sede de la reserva"
            value={branchId ?? ''}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            sx={{ maxWidth: 280 }}
          >
            {branches.map((branch) => (
              <MenuItem key={branch.id} value={branch.id}>
                {branch.name}
              </MenuItem>
            ))}
          </TextField>
        )}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <FundCard
              fundType="CASH_RESERVE"
              fund={reserve.data}
              loading={branchesLoading || reserve.isLoading}
              failed={reserve.isError}
              onInitialize={() => openInitialize('CASH_RESERVE')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FundCard
              fundType="BANK_ACCOUNT"
              fund={bank.data}
              loading={bank.isLoading}
              failed={bank.isError}
              onInitialize={() => openInitialize('BANK_ACCOUNT')}
            />
          </Grid>
        </Grid>
      </Stack>

      <FormDrawer
        open={Boolean(initializing)}
        title={initializing ? `Saldo inicial: ${FUND_INFO[initializing].label}` : ''}
        submitLabel="Configurar saldo"
        loading={initializeFund.isPending}
        submitDisabled={!canSubmit}
        onClose={() => setInitializing(null)}
        onSubmit={handleInitialize}
        width={420}
      >
        <Stack spacing={2.5}>
          <Alert severity="warning">
            El saldo inicial se configura una sola vez y no se puede corregir después. Verifica la
            cantidad antes de guardar.
          </Alert>
          <CurrencyField
            label="Saldo inicial (COP)"
            value={amount}
            onChange={setAmount}
            fullWidth
            autoFocus
          />
          <TextField
            label="Origen del saldo"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            helperText={initializing ? FUND_INFO[initializing].notesHint : undefined}
          />
        </Stack>
      </FormDrawer>
    </>
  );
}
