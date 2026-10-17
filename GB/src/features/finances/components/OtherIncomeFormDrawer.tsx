import { useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import CurrencyField from '../../../components/common/CurrencyField';
import FormDrawer from '../../../components/common/FormDrawer';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import { useBranches } from '../../../modules/branches/hooks/use-branches';
import { useCashSessions } from '../../../modules/cash-sessions/hooks/use-cash-sessions';
import {
  OTHER_INCOME_DESTINATION_LABELS,
  OTHER_INCOME_PAYMENT_METHOD_LABELS,
  OTHER_INCOME_TYPE_LABELS,
} from '../../../modules/finances/other-income-labels';
import type {
  CreateOtherIncomePayload,
  OtherIncomeDestination,
  OtherIncomePaymentMethod,
} from '../../../modules/finances/types/other-income.types';
import { formatTimeCO } from '../../../utils/format';

const incomeSchema = z.object({
  incomeType: z.enum(['SUPPLIER_REFUND', 'REIMBURSEMENT', 'PARTNER_CONTRIBUTION', 'OTHER']),
  description: z.string().trim().min(2, 'Escribe el concepto').max(255),
  receivedFrom: z.string().max(150),
  amount: z.coerce.number().positive('La cantidad debe ser mayor que cero'),
  incomeDate: z.string().min(1, 'Elige la fecha'),
  // Sin destino preseleccionado: cada uno suma el dinero en un lugar distinto, así que se elige a propósito.
  destination: z
    .string()
    .refine((value) => ['CASH_OPERATIONAL', 'CASH_RESERVE', 'BANK_ACCOUNT'].includes(value), 'Elige a dónde entró el dinero'),
  // Sin medio preseleccionado: la caja cuadra efectivo y transferencias por separado, así que no se asume.
  paymentMethod: z.string(),
  cashSessionId: z.string(),
  notes: z.string().max(1000),
});

type IncomeFormValues = z.infer<typeof incomeSchema>;

interface OtherIncomeFormDrawerProps {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateOtherIncomePayload) => void;
}

/** Registrar dinero que entra por fuera de las ventas, con el lugar donde quedó: la caja del turno o un fondo. */
export default function OtherIncomeFormDrawer({ open, loading, onClose, onSubmit }: OtherIncomeFormDrawerProps) {
  const { hasFeature } = usePermissions();
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<IncomeFormValues>({ resolver: zodResolver(incomeSchema) });
  const destination = useWatch({ control, name: 'destination' });

  // Los fondos son un servicio adicional: sin él, el dinero solo puede entrar a la caja.
  const destinations: OtherIncomeDestination[] = hasFeature('finances.funds')
    ? ['CASH_OPERATIONAL', 'CASH_RESERVE', 'BANK_ACCOUNT']
    : ['CASH_OPERATIONAL'];

  const { data: sessionPage, isLoading: sessionsLoading } = useCashSessions({ status: 'OPEN', limit: 20 });
  const openSessions = useMemo(() => sessionPage?.data ?? [], [sessionPage]);
  const { data: branchPage } = useBranches({ isActive: true, limit: 50 });
  const branchName = useMemo(() => new Map((branchPage?.data ?? []).map((b) => [b.id, b.name])), [branchPage]);
  const toCash = destination === 'CASH_OPERATIONAL';

  useEffect(() => {
    if (!open) return;
    reset({
      incomeType: 'SUPPLIER_REFUND',
      description: '',
      receivedFrom: '',
      amount: 0,
      incomeDate: dayjs().format('YYYY-MM-DD'),
      destination: '',
      paymentMethod: '',
      cashSessionId: '',
      notes: '',
    });
  }, [open, reset]);

  const submit = handleSubmit((values) => {
    if (values.destination === 'CASH_OPERATIONAL' && !values.paymentMethod) {
      setError('paymentMethod', { message: 'Indica si llegó en efectivo o por transferencia' });
      return;
    }
    if (values.destination === 'CASH_OPERATIONAL' && openSessions.length > 1 && !values.cashSessionId) {
      setError('cashSessionId', { message: 'Elige a cuál caja entró el dinero' });
      return;
    }
    onSubmit({
      incomeType: values.incomeType,
      description: values.description.trim(),
      receivedFrom: values.receivedFrom.trim() || undefined,
      amount: values.amount,
      incomeDate: values.incomeDate,
      destination: values.destination as OtherIncomeDestination,
      paymentMethod:
        values.destination === 'CASH_OPERATIONAL' ? (values.paymentMethod as OtherIncomePaymentMethod) : undefined,
      cashSessionId: values.destination === 'CASH_OPERATIONAL' ? values.cashSessionId || undefined : undefined,
      notes: values.notes.trim() || undefined,
    });
  });

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title="Registrar ingreso"
      subtitle="Dinero que entra por fuera de las ventas. Se suma de inmediato al saldo de su destino."
      submitLabel="Registrar ingreso"
      loading={loading}
      submitDisabled={toCash && !sessionsLoading && openSessions.length === 0}
      width={440}
    >
      <Stack spacing={2.5}>
        <Controller
          name="incomeType"
          control={control}
          render={({ field }) => (
            <TextField {...field} value={field.value ?? ''} select label="Tipo de ingreso" fullWidth>
              {Object.entries(OTHER_INCOME_TYPE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              value={field.value ?? ''}
              label="Concepto"
              placeholder="Ej. devolución por pedido incompleto"
              fullWidth
              error={Boolean(errors.description)}
              helperText={errors.description?.message}
            />
          )}
        />
        <Controller
          name="receivedFrom"
          control={control}
          render={({ field }) => (
            <TextField {...field} value={field.value ?? ''} label="Recibido de (opcional)" placeholder="Proveedor, persona o entidad" fullWidth />
          )}
        />
        <Stack direction="row" spacing={2}>
          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <CurrencyField
                {...field}
                value={field.value ?? ''}
                label="Cantidad (COP)"
                fullWidth
                error={Boolean(errors.amount)}
                helperText={errors.amount?.message}
              />
            )}
          />
          <Controller
            name="incomeDate"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                label="Fecha"
                type="date"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                error={Boolean(errors.incomeDate)}
                helperText={errors.incomeDate?.message}
              />
            )}
          />
        </Stack>
        <Controller
          name="destination"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              value={field.value ?? ''}
              select
              label="Entró a"
              fullWidth
              error={Boolean(errors.destination)}
              helperText={errors.destination?.message ?? 'El saldo de este lugar sube por la cantidad registrada.'}
            >
              {destinations.map((value) => (
                <MenuItem key={value} value={value}>
                  {OTHER_INCOME_DESTINATION_LABELS[value]}
                </MenuItem>
              ))}
            </TextField>
          )}
        />

        {toCash && (
          <Controller
            name="paymentMethod"
            control={control}
            render={({ field }) => (
              <FormControl error={Boolean(errors.paymentMethod)}>
                <FormLabel sx={{ mb: 1, fontSize: '0.85rem' }}>¿Cómo llegó?</FormLabel>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  value={field.value || null}
                  onChange={(_, value: OtherIncomePaymentMethod | null) => value && field.onChange(value)}
                  aria-label="Cómo llegó el dinero"
                >
                  {(Object.keys(OTHER_INCOME_PAYMENT_METHOD_LABELS) as OtherIncomePaymentMethod[]).map((method) => (
                    <ToggleButton key={method} value={method}>
                      {OTHER_INCOME_PAYMENT_METHOD_LABELS[method]}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <FormHelperText>
                  {errors.paymentMethod?.message ??
                    (field.value === 'TRANSFER'
                      ? 'Cuenta en las transferencias esperadas al cerrar la caja, no en el efectivo.'
                      : field.value === 'CASH'
                        ? 'Cuenta en el efectivo esperado al cerrar la caja.'
                        : 'La caja cuadra el efectivo y las transferencias por separado.')}
                </FormHelperText>
              </FormControl>
            )}
          />
        )}

        {toCash && !sessionsLoading && openSessions.length === 0 && (
          <Alert severity="warning">No hay ninguna caja abierta. Abre la caja o elige otro destino.</Alert>
        )}
        {toCash && openSessions.length > 1 && (
          <Controller
            name="cashSessionId"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                select
                label="Caja"
                fullWidth
                error={Boolean(errors.cashSessionId)}
                helperText={errors.cashSessionId?.message ?? 'Hay varias cajas abiertas: elige a cuál entró.'}
              >
                {openSessions.map((session) => (
                  <MenuItem key={session.id} value={session.id}>
                    {branchName.get(session.branchId) ?? 'Caja'} · abierta {formatTimeCO(session.openedAt)}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        )}

        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <TextField {...field} value={field.value ?? ''} label="Notas (opcional)" multiline minRows={2} fullWidth />
          )}
        />
      </Stack>
    </FormDrawer>
  );
}
