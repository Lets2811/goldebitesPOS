import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useSnackbar } from 'notistack';
import PageHeader from '../../../components/common/PageHeader';
import FilterBar from '../../../components/common/FilterBar';
import SearchInput from '../../../components/common/SearchInput';
import DataTable from '../../../components/common/DataTable';
import StatusChip from '../../../components/common/StatusChip';
import ErrorState from '../../../components/common/ErrorState';
import { Can } from '../../../modules/auth/components/can';
import { useSuppliers } from '../../../modules/suppliers/hooks/use-suppliers';
import { useCreateSupplier } from '../../../modules/suppliers/hooks/use-create-supplier';
import { useUpdateSupplier } from '../../../modules/suppliers/hooks/use-update-supplier';
import { useSetSupplierStatus } from '../../../modules/suppliers/hooks/use-set-supplier-status';
import { normalizeApiError } from '../../../lib/api/api-error';
import type { Supplier } from '../../../modules/suppliers/types/supplier.types';
import type { SupplierFormValues } from '../schemas/supplierSchema';
import SupplierDetailDrawer from '../components/SupplierDetailDrawer';
import SupplierFormDrawer from '../components/SupplierFormDrawer';

export default function SuppliersPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'activo' | 'inactivo'>('todos');
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const filters = useMemo(
    () => ({
      limit: 100,
      search: search || undefined,
      isActive: statusFilter === 'todos' ? undefined : statusFilter === 'activo',
    }),
    [search, statusFilter],
  );

  const { data, isLoading, isError, refetch } = useSuppliers(filters);
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const setSupplierStatus = useSetSupplierStatus();

  const suppliers = data?.data ?? [];

  const handleSubmit = (values: SupplierFormValues) => {
    const payload = {
      name: values.name,
      taxId: values.taxId || undefined,
      contactName: values.contactName || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      address: values.address || undefined,
      notes: values.notes || undefined,
      creditDays: values.creditDays ? Number(values.creditDays) : undefined,
    };

    if (editingSupplier) {
      updateSupplier.mutate(
        { id: editingSupplier.id, payload },
        {
          onSuccess: () => {
            enqueueSnackbar('Proveedor actualizado correctamente', { variant: 'success' });
            setFormOpen(false);
          },
          onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
        },
      );
    } else {
      createSupplier.mutate(payload, {
        onSuccess: () => {
          enqueueSnackbar('Proveedor creado correctamente', { variant: 'success' });
          setFormOpen(false);
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      });
    }
  };

  const handleToggleStatus = (supplier: Supplier) => {
    setSupplierStatus.mutate(
      { id: supplier.id, isActive: !supplier.isActive },
      {
        onSuccess: (updated) => {
          enqueueSnackbar(updated.isActive ? 'Proveedor activado' : 'Proveedor desactivado', {
            variant: 'success',
          });
          setSelected(updated);
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );
  };

  const columns: ColumnDef<Supplier, unknown>[] = [
    { accessorKey: 'name', header: 'Proveedor' },
    {
      id: 'contactName',
      header: 'Contacto',
      cell: ({ row }) => row.original.contactName ?? '—',
    },
    {
      id: 'phone',
      header: 'Teléfono',
      cell: ({ row }) => row.original.phone ?? '—',
    },
    {
      id: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <StatusChip
          label={row.original.isActive ? 'Activo' : 'Inactivo'}
          tone={row.original.isActive ? 'success' : 'neutral'}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Proveedores"
        subtitle="Directorio de proveedores del negocio."
        breadcrumbs={[{ label: 'Proveedores' }]}
        actions={
          <Can permission="suppliers.manage">
            <Button
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => {
                setEditingSupplier(null);
                setFormOpen(true);
              }}
            >
              Nuevo proveedor
            </Button>
          </Can>
        }
      />

      <FilterBar
        onClear={() => {
          setSearch('');
          setStatusFilter('todos');
        }}
        hasActiveFilters={Boolean(search) || statusFilter !== 'todos'}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar proveedor..." />
        <TextField
          select
          size="small"
          label="Estado"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="todos">Todos</MenuItem>
          <MenuItem value="activo">Activos</MenuItem>
          <MenuItem value="inactivo">Inactivos</MenuItem>
        </TextField>
      </FilterBar>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={suppliers}
          isLoading={isLoading}
          onRowClick={(row) => setSelected(row)}
          emptyTitle="No hay proveedores con esta búsqueda"
          pageSize={10}
        />
      )}

      <SupplierDetailDrawer
        supplier={selected}
        onClose={() => setSelected(null)}
        onEdit={(s) => {
          setSelected(null);
          setEditingSupplier(s);
          setFormOpen(true);
        }}
        onToggleStatus={handleToggleStatus}
      />

      <SupplierFormDrawer
        open={formOpen}
        initialSupplier={editingSupplier}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
}
