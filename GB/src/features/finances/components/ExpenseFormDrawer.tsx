import { useEffect } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormDrawer from '../../../components/common/FormDrawer';
import CurrencyField from '../../../components/common/CurrencyField';
import { useExpenseCategories } from '../../../modules/finances/hooks/use-expense-categories';
import {
  EXPENSE_PAYMENT_SOURCE_LABELS,
  SELECTABLE_EXPENSE_PAYMENT_SOURCES,
  isExpenseAmountLocked,
} from '../../../modules/finances/expense-payment-source';
import { expenseSchema, type ExpenseFormValues } from '../schemas/expenseSchema';
import type { Expense } from '../../../modules/finances/types/expense.types';

interface ExpenseFormDrawerProps {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: ExpenseFormValues) => void;
  initialExpense?: Expense | null;
  defaultCategory?: ExpenseFormValues['category'];
}

const emptyValues: ExpenseFormValues = {
  // Sin tipo preseleccionado: los tipos son del negocio y se elige el que corresponde.
  category: '',
  name: '',
  description: '',
  responsible: '',
  amount: 0,
  expenseDate: new Date().toISOString().slice(0, 10),
  // Sin fuente preseleccionada: cada una mueve dinero de un lugar distinto, así que se elige a propósito.
  paymentSource: '' as ExpenseFormValues['paymentSource'],
  payerName: '',
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
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (open) {
      reset(
        initialExpense
          ? {
              category: initialExpense.category,
              name: initialExpense.name ?? '',
              description: initialExpense.description,
              responsible: initialExpense.responsible ?? '',
              amount: initialExpense.amount,
              expenseDate: initialExpense.expenseDate.slice(0, 10),
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
  const paymentSource = useWatch({ control, name: 'paymentSource' });
  // Al editar, la fuente ya movió el dinero: no se cambia desde aquí, ni el monto que movió.
  const editing = Boolean(initialExpense);
  const amountLocked = Boolean(initialExpense && isExpenseAmountLocked(initialExpense));

  const submit = handleSubmit((values) => onSubmit(values));

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={initialExpense ? 'Editar gasto' : 'Nuevo gasto'}
      submitLabel={initialExpense ? 'Guardar cambios' : 'Registrar gasto'}
      loading={loading}
      width={420}
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

        {paymentSource === 'PERSONAL_MONEY' && (
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
