import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useSnackbar } from 'notistack';
import { Check, LayoutDashboard } from 'lucide-react';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import PageHeader from '../../../components/common/PageHeader';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import { expenseErrorMessage, toUpdateExpensePayload } from '../../../modules/finances/expense-payment-source';
import { useDeleteExpense } from '../../../modules/finances/hooks/use-delete-expense';
import { useExpenseCategories } from '../../../modules/finances/hooks/use-expense-categories';
import { useUpdateExpense } from '../../../modules/finances/hooks/use-update-expense';
import type { Expense } from '../../../modules/finances/types/expense.types';
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
        subtitle="Ventas, gastos y utilidad del negocio en el período que elijas."
        breadcrumbs={[{ label: 'Finanzas' }]}
        actions={
          showFunds ? undefined : (
            <Button
              variant={customizing ? 'contained' : 'outlined'}
              startIcon={customizing ? <Check size={16} /> : <LayoutDashboard size={16} />}
              onClick={() => setCustomizing((current) => !current)}
            >
              {customizing ? 'Listo' : 'Personalizar'}
            </Button>
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
    </>
  );
}
