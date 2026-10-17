import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useSnackbar } from 'notistack';
import { Check, LayoutDashboard, Plus } from 'lucide-react';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import PageHeader from '../../../components/common/PageHeader';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import { expenseErrorMessage, toUpdateExpensePayload } from '../../../modules/finances/expense-payment-source';
import { useDeleteExpense } from '../../../modules/finances/hooks/use-delete-expense';
import { useExpenseCategories } from '../../../modules/finances/hooks/use-expense-categories';
import { useUpdateExpense } from '../../../modules/finances/hooks/use-update-expense';
import type { Expense } from '../../../modules/finances/types/expense.types';
import { useCreateOtherIncome, useVoidOtherIncome } from '../../../modules/finances/hooks/use-other-incomes';
import { otherIncomeErrorMessage } from '../../../modules/finances/other-income-labels';
import type { OtherIncome } from '../../../modules/finances/types/other-income.types';
import OtherIncomeFormDrawer from '../components/OtherIncomeFormDrawer';
import VoidIncomeDialog from '../components/VoidIncomeDialog';
import ExpenseFormDrawer from '../components/ExpenseFormDrawer';
import FundsTab from '../components/FundsTab';
import PeriodPicker from '../components/PeriodPicker';
import FinanceDashboard from '../dashboard/FinanceDashboard';
import { useFinanceData } from '../dashboard/use-finance-data';
import { periodAround, type Period } from '../period';
import type { ExpenseFormValues } from '../schemas/expenseSchema';

export default function FinancesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { hasFeature, hasPermission } = usePermissions();
  // Los fondos son un servicio adicional: la pestaña solo existe para quien lo tiene.
  const hasFunds = hasFeature('finances.funds');
  const canManage = hasPermission('finances.manage');
  const [tab, setTab] = useState<'resumen' | 'fondos'>('resumen');
  const showFunds = hasFunds && tab === 'fondos';

  // Se abre en el mes en curso, que es como se suele mirar un negocio.
  const [period, setPeriod] = useState<Period>(() => periodAround('month'));
  const [customizing, setCustomizing] = useState(false);
  const data = useFinanceData(period);
  const { labelOf: categoryLabel } = useExpenseCategories();

  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const createIncome = useCreateOtherIncome();
  const voidIncome = useVoidOtherIncome();
  const [incomeFormOpen, setIncomeFormOpen] = useState(false);
  const [voidingIncome, setVoidingIncome] = useState<OtherIncome | null>(null);

  const onError = (error: unknown) => enqueueSnackbar(expenseErrorMessage(error), { variant: 'error' });

  // Los gastos se registran en "Compras y gastos"; aquí solo se corrigen los ya registrados.
  const handleSubmit = (values: ExpenseFormValues) => {
    if (!editingExpense) return;
    updateExpense.mutate(
      { id: editingExpense.id, payload: toUpdateExpensePayload(values, editingExpense) },
      {
        onSuccess: () => {
          enqueueSnackbar('Gasto actualizado correctamente', { variant: 'success' });
          setEditingExpense(null);
        },
        onError,
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Finanzas"
        subtitle="Ventas, gastos, otros ingresos y utilidad del negocio en el período que elijas."
        breadcrumbs={[{ label: 'Finanzas' }]}
        actions={
          showFunds ? undefined : (
            <>
              <Button
                variant={customizing ? 'contained' : 'outlined'}
                startIcon={customizing ? <Check size={16} /> : <LayoutDashboard size={16} />}
                onClick={() => setCustomizing((current) => !current)}
              >
                {customizing ? 'Listo' : 'Personalizar'}
              </Button>
              {canManage && (
                <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setIncomeFormOpen(true)}>
                  Registrar ingreso
                </Button>
              )}
            </>
          )
        }
      />

      {hasFunds && (
        <Tabs value={tab} onChange={(_, value: 'resumen' | 'fondos') => setTab(value)} sx={{ mb: 2 }}>
          <Tab label="Resumen" value="resumen" />
          <Tab label="Fondos" value="fondos" />
        </Tabs>
      )}

      {showFunds ? (
        <FundsTab />
      ) : (
        <Stack spacing={2.5}>
          <Box>
            <PeriodPicker value={period} onChange={setPeriod} />
          </Box>
          <FinanceDashboard
            editing={customizing}
            context={{
              data,
              categoryLabel,
              onEditExpense: canManage ? setEditingExpense : undefined,
              onDeleteExpense: canManage ? setDeletingExpense : undefined,
              onVoidIncome: canManage ? setVoidingIncome : undefined,
            }}
          />
        </Stack>
      )}

      <ExpenseFormDrawer
        open={Boolean(editingExpense)}
        loading={updateExpense.isPending}
        initialExpense={editingExpense}
        onClose={() => setEditingExpense(null)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deletingExpense)}
        title="Eliminar gasto"
        description={`¿Seguro que deseas eliminar "${deletingExpense?.name ?? deletingExpense?.description}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onClose={() => setDeletingExpense(null)}
        onConfirm={() => {
          if (!deletingExpense) return;
          deleteExpense.mutate(deletingExpense.id, {
            onSuccess: () => enqueueSnackbar('Gasto eliminado', { variant: 'success' }),
            onError,
            onSettled: () => setDeletingExpense(null),
          });
        }}
      />

      <OtherIncomeFormDrawer
        open={incomeFormOpen}
        loading={createIncome.isPending}
        onClose={() => setIncomeFormOpen(false)}
        onSubmit={(payload) =>
          createIncome.mutate(payload, {
            onSuccess: () => {
              enqueueSnackbar('Ingreso registrado', { variant: 'success' });
              setIncomeFormOpen(false);
            },
            onError: (error) =>
              enqueueSnackbar(otherIncomeErrorMessage(error, payload.destination), { variant: 'error' }),
          })
        }
      />

      <VoidIncomeDialog
        income={voidingIncome}
        loading={voidIncome.isPending}
        onClose={() => setVoidingIncome(null)}
        onConfirm={(reason) => {
          if (!voidingIncome) return;
          voidIncome.mutate(
            { id: voidingIncome.id, reason },
            {
              onSuccess: () => {
                enqueueSnackbar('Ingreso anulado', { variant: 'success' });
                setVoidingIncome(null);
              },
              onError: (error) =>
                enqueueSnackbar(otherIncomeErrorMessage(error, voidingIncome.destination), { variant: 'error' }),
            },
          );
        }}
      />
    </>
  );
}
