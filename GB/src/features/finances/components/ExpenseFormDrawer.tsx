import { useEffect, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FormDrawer from '../../../components/common/FormDrawer';
import CurrencyField from '../../../components/common/CurrencyField';
import { useExpenseCategories } from '../../../modules/finances/hooks/use-expense-categories';
import {
  EXPENSE_PAYMENT_SOURCE_LABELS,
  SELECTABLE_EXPENSE_PAYMENT_SOURCES,
  SUPPLIER_PAYMENT_SOURCE_LABELS,
  isExpenseAmountLocked,
} from '../../../modules/finances/expense-payment-source';
import { useSuppliers } from '../../../modules/suppliers/hooks/use-suppliers';
import { formatCOP } from '../../../utils/format';
import { expenseSchema, type ExpenseFormValues, type ExpensePaymentMode } from '../schemas/expenseSchema';
import type { Expense, SupplierPaymentSource } from '../../../modules/finances/types/expense.types';

interface ExpenseFormDrawerProps {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: ExpenseFormValues) => void;
  initialExpense?: Expense | null;
  defaultCategory?: ExpenseFormValues['category'];
}

const PAYMENT_MODES: { value: ExpensePaymentMode; label: string }[] = [
  { value: 'CASH_PAID', label: 'De contado' },
  { value: 'CREDIT', label: 'A crédito' },
  { value: 'PARTIAL', label: 'Pago parcial' },
];

const emptyValues: ExpenseFormValues = {
  // Sin tipo preseleccionado: los tipos son del negocio y se elige el que corresponde.
  category: '',
  name: '',
  description: '',
  responsible: '',
  amount: 0,
  expenseDate: new Date().toISOString().slice(0, 10),
  supplierId: '',
  paymentMode: 'CASH_PAID',
  // Sin fuente preseleccionada: cada una mueve dinero de un lugar distinto, así que se elige a propósito.
  paymentSource: '',
  payerName: '',
  dueDate: '',
  initialAmount: 0,
  initialSource: '',
};

export default function ExpenseFormDrawer({
  open,
  loading,
  onClose,
  onSubmit,
  initialExpense,
  defaultCategory,
}: ExpenseFormDrawerProps) {
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: emptyValues,
  });
  // Mientras no se toque a mano, el vencimiento sigue a la fecha y a los días de crédito del proveedor.
  const dueDateTouched = useRef(false);

  useEffect(() => {
    if (open) {
      dueDateTouched.current = false;
      reset(
        initialExpense
          ? {
              ...emptyValues,
              category: initialExpense.category,
              name: initialExpense.name ?? '',
              description: initialExpense.description,
              responsible: initialExpense.responsible ?? '',
              amount: initialExpense.amount,
              expenseDate: initialExpense.expenseDate.slice(0, 10),
              supplierId: initialExpense.supplierId ?? '',
              paymentMode: initialExpense.paymentSource === 'SUPPLIER_CREDIT' ? 'CREDIT' : 'CASH_PAID',
              paymentSource: initialExpense.paymentSource,
              payerName: initialExpense.payerName ?? '',
            }
          : { ...emptyValues, category: defaultCategory ?? emptyValues.category },
      );
    }
  }, [open, initialExpense, defaultCategory, reset]);

  const { active: activeCategories, categories } = useExpenseCategories();
  // Al editar, el tipo del gasto se ofrece aunque ya esté desactivado.
  const categoryOptions = initialExpense
    ? categories.filter((category) => category.isActive || category.code === initialExpense.category)
    : activeCategories;
  const { data: supplierPage } = useSuppliers({ isActive: true, limit: 100 });
  const suppliers = useMemo(() => supplierPage?.data ?? [], [supplierPage]);

  const paymentSource = useWatch({ control, name: 'paymentSource' });
  const paymentMode = useWatch({ control, name: 'paymentMode' });
  const supplierId = useWatch({ control, name: 'supplierId' });
  const expenseDate = useWatch({ control, name: 'expenseDate' });
  const amount = useWatch({ control, name: 'amount' });
  const initialAmount = useWatch({ control, name: 'initialAmount' });
  const supplier = suppliers.find((candidate) => candidate.id === supplierId);
  const onCredit = paymentMode !== 'CASH_PAID';

  useEffect(() => {
    if (!onCredit || dueDateTouched.current) return;
    const days = supplier?.creditDays;
    setValue('dueDate', days != null && expenseDate ? dayjs(expenseDate).add(days, 'day').format('YYYY-MM-DD') : '');
  }, [onCredit, supplier, expenseDate, setValue]);

  // Al editar, la fuente ya movió el dinero: no se cambia desde aquí, ni el monto que movió.
  const editing = Boolean(initialExpense);
  const amountLocked = Boolean(initialExpense && isExpenseAmountLocked(initialExpense));

  const submit = handleSubmit((values) => onSubmit(values));
  const pendingAfter = Math.max(0, (Number(amount) || 0) - (paymentMode === 'PARTIAL' ? Number(initialAmount) || 0 : 0));

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={initialExpense ? 'Editar gasto' : 'Nuevo gasto'}
      submitLabel={initialExpense ? 'Guardar cambios' : 'Registrar gasto'}
      loading={loading}
      width={460}
    >
      <Stack spacing={2.5}>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Nombre"
              fullWidth
              error={Boolean(errors.name)}
              helperText={errors.name?.message}
            />
          )}
        />

        <Controller
          name="amount"
          control={control}
          render={({ field }) => (
            <CurrencyField
              {...field}
              label="Cantidad (COP)"
              fullWidth
              disabled={amountLocked}
              error={Boolean(errors.amount)}
              helperText={
                errors.amount?.message ??
                (amountLocked ? 'Para cambiar la cantidad, elimina el gasto y regístralo de nuevo.' : undefined)
              }
            />
          )}
        />

        <Controller
          name="supplierId"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              select
              label={onCredit ? 'Proveedor' : 'Proveedor (opcional)'}
              fullWidth
              disabled={editing}
              error={Boolean(errors.supplierId)}
              helperText={
                errors.supplierId?.message ??
                (supplier?.creditDays != null ? `Da ${supplier.creditDays} días de crédito.` : undefined)
              }
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            >
              <MenuItem value="">Sin proveedor</MenuItem>
              {suppliers.map((candidate) => (
                <MenuItem key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        />

        {!editing && (
          <Controller
            name="paymentMode"
            control={control}
            render={({ field }) => (
              <FormControl>
                <FormLabel sx={{ mb: 1, fontSize: '0.85rem' }}>Forma de pago</FormLabel>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  value={field.value}
                  onChange={(_, value: ExpensePaymentMode | null) => value && field.onChange(value)}
                  aria-label="Forma de pago"
                >
                  {PAYMENT_MODES.map((mode) => (
                    <ToggleButton key={mode.value} value={mode.value}>
                      {mode.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </FormControl>
            )}
          />
        )}

        {paymentMode === 'CASH_PAID' && (
          <Controller
            name="paymentSource"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label="Pagado con"
                fullWidth
                disabled={editing}
                error={Boolean(errors.paymentSource)}
                helperText={errors.paymentSource?.message}
              >
                {SELECTABLE_EXPENSE_PAYMENT_SOURCES.map((source) => (
                  <MenuItem key={source} value={source}>
                    {EXPENSE_PAYMENT_SOURCE_LABELS[source]}
                  </MenuItem>
                ))}
                {/* Solo para mostrar un gasto antiguo; no se puede elegir. */}
                {paymentSource === 'UNSPECIFIED_HISTORICAL' && (
                  <MenuItem value="UNSPECIFIED_HISTORICAL">{EXPENSE_PAYMENT_SOURCE_LABELS.UNSPECIFIED_HISTORICAL}</MenuItem>
                )}
              </TextField>
            )}
          />
        )}

        {paymentMode === 'CASH_PAID' && paymentSource === 'PERSONAL_MONEY' && (
          <Controller
            name="payerName"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Quién pagó"
                fullWidth
                disabled={editing}
                error={Boolean(errors.payerName)}
                helperText={errors.payerName?.message ?? (editing ? undefined : 'Queda registrado para devolverle el dinero.')}
              />
            )}
          />
        )}

        {editing && initialExpense?.payable && (
          <Alert severity="info">
            Compra a crédito: pagado {formatCOP(initialExpense.payable.paidAmount)}, debe{' '}
            {formatCOP(initialExpense.payable.pendingAmount)}. Los pagos se registran en Cuentas por pagar.
          </Alert>
        )}

        {!editing && paymentMode === 'PARTIAL' && (
          <Stack direction="row" spacing={2}>
            <Controller
              name="initialAmount"
              control={control}
              render={({ field }) => (
                <CurrencyField
                  {...field}
                  label="Pagado ahora"
                  fullWidth
                  error={Boolean(errors.initialAmount)}
                  helperText={errors.initialAmount?.message}
                />
              )}
            />
            <Controller
              name="initialSource"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Pagado desde"
                  fullWidth
                  error={Boolean(errors.initialSource)}
                  helperText={errors.initialSource?.message}
                >
                  {(Object.keys(SUPPLIER_PAYMENT_SOURCE_LABELS) as SupplierPaymentSource[]).map((source) => (
                    <MenuItem key={source} value={source}>
                      {SUPPLIER_PAYMENT_SOURCE_LABELS[source]}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Stack>
        )}

        {!editing && onCredit && (
          <>
            <Controller
              name="dueDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Vence el (opcional)"
                  type="date"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  onChange={(e) => {
                    dueDateTouched.current = true;
                    field.onChange(e);
                  }}
                />
              )}
            />
            <Alert severity="info" variant="outlined">
              Queda debiéndose {formatCOP(pendingAfter)}. El gasto cuenta a medida que se paga: lo pagado hoy cuenta
              hoy, y el resto el día de cada pago.
            </Alert>
          </>
        )}

        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Motivo"
              multiline
              minRows={2}
              fullWidth
              error={Boolean(errors.description)}
              helperText={errors.description?.message}
            />
          )}
        />

        <Controller
          name="expenseDate"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Fecha"
              type="date"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              error={Boolean(errors.expenseDate)}
              helperText={errors.expenseDate?.message}
            />
          )}
        />

        <Controller
          name="responsible"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Responsable"
              fullWidth
              error={Boolean(errors.responsible)}
              helperText={errors.responsible?.message}
            />
          )}
        />

        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              select
              label="Tipo de gasto"
              fullWidth
              error={Boolean(errors.category)}
              helperText={errors.category?.message}
            >
              {categoryOptions.map((category) => (
                <MenuItem key={category.code} value={category.code}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      </Stack>
    </FormDrawer>
  );
}
