import { useState } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import type { ColumnDef } from '@tanstack/react-table';
import { useSnackbar } from 'notistack';
import { ShoppingCart, Plus, Trash2 } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import DataTable from '../../../components/common/DataTable';
import DateDisplay from '../../../components/common/DateDisplay';
import EmptyState from '../../../components/common/EmptyState';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { Can } from '../../../modules/auth/components/can';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useLowStock } from '../../../modules/inventory/hooks/use-low-stock';
import { useExpenses } from '../../../modules/finances/hooks/use-expenses';
import { useCreateExpense } from '../../../modules/finances/hooks/use-create-expense';
import { useDeleteExpense } from '../../../modules/finances/hooks/use-delete-expense';
import { useExpenseCategories } from '../../../modules/finances/hooks/use-expense-categories';
import {
  EXPENSE_PAYMENT_SOURCE_LABELS,
  expenseErrorMessage,
  toCreateExpensePayload,
} from '../../../modules/finances/expense-payment-source';
import { normalizeApiError } from '../../../lib/api/api-error';
import { formatCOP } from '../../../utils/format';
import type { Expense } from '../../../modules/finances/types/expense.types';
import type { ExpenseFormValues } from '../../finances/schemas/expenseSchema';
import ExpenseFormDrawer from '../../finances/components/ExpenseFormDrawer';

/**
 * Compras y gastos: what the inventory says should be bought, and the record
 * of what was spent.
 *
 * Purchase orders are switched off for now, tab and "Generar orden de compra"
 * button included. Their drawers (../components) and hooks
 * (modules/purchases) are still in the codebase, unused, for when they return.
 */
export default function PurchasesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const branchId = useAuthStore((s) => s.user?.branchId ?? null);

  const [tab, setTab] = useState<'sugerencia' | 'gastos'>('sugerencia');
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const { data: lowStock } = useLowStock(branchId ?? undefined);

  const { data: expensesData } = useExpenses({ limit: 100 });
  const expenses = expensesData?.data ?? [];
  const { labelOf: categoryLabel } = useExpenseCategories();
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();

  function handleCreateExpense(values: ExpenseFormValues) {
    createExpense.mutate(toCreateExpensePayload(values, branchId ?? undefined), {
      onSuccess: () => {
        enqueueSnackbar('Gasto registrado correctamente', { variant: 'success' });
        setExpenseFormOpen(false);
      },
      onError: (error) => enqueueSnackbar(expenseErrorMessage(error, values.paymentSource), { variant: 'error' }),
    });
  }

  const expenseColumns: ColumnDef<Expense, unknown>[] = [
    { id: 'date', header: 'Fecha', cell: ({ row }) => <DateDisplay value={row.original.expenseDate} variant="body2" /> },
    { id: 'name', header: 'Nombre', cell: ({ row }) => row.original.name ?? '—' },
    { accessorKey: 'description', header: 'Motivo' },
    { id: 'responsible', header: 'Responsable', cell: ({ row }) => row.original.responsible ?? '—' },
    { id: 'category', header: 'Tipo', cell: ({ row }) => categoryLabel(row.original.category) },
    { id: 'paymentSource', header: 'Pagado con', cell: ({ row }) => EXPENSE_PAYMENT_SOURCE_LABELS[row.original.paymentSource] },
    { id: 'amount', header: 'Cantidad', cell: ({ row }) => formatCOP(row.original.amount) },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Can permission="finances.manage">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingExpense(row.original);
            }}
          >
            <Trash2 size={14} />
          </IconButton>
        </Can>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Compras y gastos"
        subtitle="Sugerencias de compra basadas en inventario y registro de gastos."
        breadcrumbs={[{ label: 'Compras y gastos' }]}
        actions={
          tab === 'gastos' ? (
            <Can permission="finances.manage">
              <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setExpenseFormOpen(true)}>
                Registrar gasto
              </Button>
            </Can>
          ) : undefined
        }
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Sugerencia de compra" value="sugerencia" />
        <Tab label="Gastos" value="gastos" />
      </Tabs>

      {tab === 'sugerencia' ? (
        !lowStock || lowStock.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No hay insumos por debajo del stock mínimo"
            description="Cuando el inventario baje del mínimo configurado, aparecerán aquí las sugerencias de compra."
          />
        ) : (
          <DataTable
            columns={[
              { accessorKey: 'name', header: 'Insumo' },
              { accessorKey: 'currentStock', header: 'Stock actual' },
              { accessorKey: 'minimumStock', header: 'Mínimo' },
              { id: 'unit', header: 'Unidad', cell: ({ row }) => row.original.unit },
            ]}
            data={lowStock}
            getRowId={(row) => row.inventoryItemId}
            hidePagination
          />
        )
      ) : (
        <DataTable
          columns={expenseColumns}
          data={expenses}
          emptyTitle="No hay gastos registrados"
          emptyDescription="Registra compras, insumos u otros gastos del negocio."
          pageSize={10}
        />
      )}

      <ExpenseFormDrawer
        open={expenseFormOpen}
        loading={createExpense.isPending}
        defaultCategory="COGS"
        onClose={() => setExpenseFormOpen(false)}
        onSubmit={handleCreateExpense}
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
            onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
            onSettled: () => setDeletingExpense(null),
          });
        }}
      />
    </>
  );
}
