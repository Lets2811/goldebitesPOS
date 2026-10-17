import { useState } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import type { ColumnDef } from '@tanstack/react-table';
import { useSnackbar } from 'notistack';
import { ShoppingCart, Plus, Trash2, Paperclip } from 'lucide-react';
import Badge from '@mui/material/Badge';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
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
import SupplierPayablesTab from '../../finances/components/SupplierPayablesTab';
import PurchaseFormDrawer from '../components/PurchaseFormDrawer';
import ExpenseAttachmentsDialog from '../components/ExpenseAttachmentsDialog';
import { useUploadExpenseAttachments } from '../../../modules/finances/hooks/use-expense-attachments';
import type { CreateExpensePayload } from '../../../modules/finances/types/expense.types';

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

  const [tab, setTab] = useState<'sugerencia' | 'gastos' | 'por-pagar'>('sugerencia');
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false);
  const [attachmentsFor, setAttachmentsFor] = useState<Expense | null>(null);
  const uploadAttachments = useUploadExpenseAttachments();

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
      onError: (error) => enqueueSnackbar(
          expenseErrorMessage(
            error,
            (values.paymentMode === 'PARTIAL' ? values.initialSource : values.paymentSource) as Parameters<typeof expenseErrorMessage>[1],
          ),
          { variant: 'error' },
        ),
    });
  }

  /** Primero la compra; con ella creada, sus comprobantes. Si alguno no sube, la compra igual queda. */
  function handleCreatePurchase(payload: CreateExpensePayload, files: File[]) {
    const source = payload.initialPayment?.source ?? payload.paymentSource;
    createExpense.mutate(
      { ...payload, branchId: branchId ?? undefined },
      {
        onSuccess: (purchase) => {
          setPurchaseFormOpen(false);
          if (files.length === 0) {
            enqueueSnackbar('Compra registrada', { variant: 'success' });
            return;
          }
          uploadAttachments.mutate(
            { expenseId: purchase.id, files },
            {
              onSuccess: ({ failed }) =>
                failed.length > 0
                  ? enqueueSnackbar(
                      `Compra registrada, pero no se pudo subir: ${failed.join(', ')}. Agrégalo desde el clip de la compra.`,
                      { variant: 'warning' },
                    )
                  : enqueueSnackbar('Compra registrada con sus comprobantes', { variant: 'success' }),
            },
          );
        },
        onError: (error) =>
          enqueueSnackbar(expenseErrorMessage(error, source as Parameters<typeof expenseErrorMessage>[1]), {
            variant: 'error',
          }),
      },
    );
  }

  const expenseColumns: ColumnDef<Expense, unknown>[] = [
    { id: 'date', header: 'Fecha', cell: ({ row }) => <DateDisplay value={row.original.expenseDate} variant="body2" /> },
    { id: 'name', header: 'Nombre', cell: ({ row }) => row.original.name ?? '—' },
    { accessorKey: 'description', header: 'Motivo' },
    { id: 'responsible', header: 'Responsable', cell: ({ row }) => row.original.responsible ?? '—' },
    { id: 'category', header: 'Tipo', cell: ({ row }) => categoryLabel(row.original.category) },
    { id: 'supplier', header: 'Proveedor', cell: ({ row }) => row.original.supplierName ?? '—' },
    {
      id: 'paymentSource',
      header: 'Pagado con',
      cell: ({ row }) => {
        const payable = row.original.payable;
        if (!payable) return EXPENSE_PAYMENT_SOURCE_LABELS[row.original.paymentSource];
        // Una compra a crédito: cuánto queda por pagar, o que ya se pagó.
        return payable.pendingAmount > 0
          ? `Crédito · debe ${formatCOP(payable.pendingAmount)}`
          : 'Crédito · pagada';
      },
    },
    { id: 'amount', header: 'Cantidad', cell: ({ row }) => formatCOP(row.original.amount) },
    {
      id: 'attachments',
      header: 'Comprobantes',
      cell: ({ row }) => {
        const count = row.original.attachmentCount ?? 0;
        return (
          <Tooltip title={count > 0 ? `${count} comprobante${count === 1 ? '' : 's'}` : 'Sin comprobantes'}>
            <IconButton
              size="small"
              aria-label="Comprobantes"
              onClick={(e) => {
                e.stopPropagation();
                setAttachmentsFor(row.original);
              }}
            >
              <Badge badgeContent={count} color="primary" invisible={count === 0}>
                <Paperclip size={15} style={{ opacity: count > 0 ? 1 : 0.45 }} />
              </Badge>
            </IconButton>
          </Tooltip>
        );
      },
    },
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
        subtitle="Registro de compras y gastos, lo que se les debe a los proveedores y sugerencias de compra según el inventario."
        breadcrumbs={[{ label: 'Compras y gastos' }]}
        actions={
          tab !== 'sugerencia' ? (
            <Can permission="finances.manage">
              <Stack direction="row" spacing={1.5}>
                {tab === 'gastos' && (
                  <Button variant="outlined" onClick={() => setExpenseFormOpen(true)}>
                    Registrar gasto
                  </Button>
                )}
                <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setPurchaseFormOpen(true)}>
                  Registrar compra
                </Button>
              </Stack>
            </Can>
          ) : undefined
        }
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Sugerencia de compra" value="sugerencia" />
        <Tab label="Compras y gastos" value="gastos" />
        <Tab label="Cuentas por pagar" value="por-pagar" />
      </Tabs>

      {tab === 'por-pagar' ? (
        <SupplierPayablesTab />
      ) : tab === 'sugerencia' ? (
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

      <PurchaseFormDrawer
        open={purchaseFormOpen}
        loading={createExpense.isPending || uploadAttachments.isPending}
        onClose={() => setPurchaseFormOpen(false)}
        onSubmit={handleCreatePurchase}
      />

      <ExpenseAttachmentsDialog expense={attachmentsFor} onClose={() => setAttachmentsFor(null)} />

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
