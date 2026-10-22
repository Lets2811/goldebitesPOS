import { useMemo, useState } from 'react';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { type ColumnDef } from '@tanstack/react-table';
import { Boxes, PackagePlus, AlertTriangle, Wallet2, Plus, Tags } from 'lucide-react';
import { useSnackbar } from 'notistack';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import FilterBar from '../../../components/common/FilterBar';
import SearchInput from '../../../components/common/SearchInput';
import DataTable from '../../../components/common/DataTable';
import StatusChip from '../../../components/common/StatusChip';
import ErrorState from '../../../components/common/ErrorState';
import { Can } from '../../../modules/auth/components/can';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useInventoryItems } from '../../../modules/inventory/hooks/use-inventory-items';
import { useStock } from '../../../modules/inventory/hooks/use-stock';
import { useLowStock } from '../../../modules/inventory/hooks/use-low-stock';
import { useCreateInventoryItem } from '../../../modules/inventory/hooks/use-create-inventory-item';
import { useUpdateInventoryItem } from '../../../modules/inventory/hooks/use-update-inventory-item';
import { useSetInventoryItemStatus } from '../../../modules/inventory/hooks/use-set-inventory-item-status';
import { useCreateAdjustment } from '../../../modules/inventory/hooks/use-create-adjustment';
import { useInventoryItemCategories } from '../../../modules/inventory-item-categories/hooks/use-inventory-item-categories';
import { normalizeApiError } from '../../../lib/api/api-error';
import { formatCOP } from '../../../utils/format';
import type { InventoryItem } from '../../../modules/inventory/types/inventory.types';
import type { InventoryItemFormValues } from '../schemas/inventoryItemSchema';
import InventoryDetailDrawer from '../components/InventoryDetailDrawer';
import InventoryMovementDrawer from '../components/InventoryMovementDrawer';
import InventoryItemFormDrawer from '../components/InventoryItemFormDrawer';
import InventoryCategoryManagerDialog from '../components/InventoryCategoryManagerDialog';
import SpecializedQueriesTab from '../components/SpecializedQueriesTab';
import { useAllBranchesReview } from '../../../modules/auth/hooks/use-branch-mode';
import { useBranchNames } from '../../../modules/branches/hooks/use-branch-names';

type TabKey = 'inventario' | 'consultas';

export default function InventoryPage() {
  const { enqueueSnackbar } = useSnackbar();
  const branchId = useAuthStore((s) => s.user?.branchId ?? undefined);
  const { hasFeature } = usePermissions();
  const specializedQueriesEnabled = hasFeature('inventory.specializedQueries');

  const [tab, setTab] = useState<TabKey>('inventario');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'activos' | 'inactivos'>('activos');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [movementDrawerOpen, setMovementDrawerOpen] = useState(false);
  const [movementDefaultItemId, setMovementDefaultItemId] = useState<string | undefined>(undefined);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  const itemFilters = useMemo(
    () => ({
      limit: 100,
      search: search || undefined,
      categoryId: categoryFilter === 'todas' ? undefined : categoryFilter,
      isActive: statusFilter === 'todos' ? undefined : statusFilter === 'activos',
    }),
    [search, statusFilter, categoryFilter],
  );

  const { data: itemsData, isLoading, isError, refetch } = useInventoryItems(itemFilters);
  const { data: stockLevels } = useStock({ branchId });
  const { data: lowStock } = useLowStock(branchId);
  const reviewOnly = useAllBranchesReview();
  const branchNames = useBranchNames();
  /** In "Todas las sedes": the items low at some branch, with which. */
  const lowAt = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const alert of lowStock ?? []) {
      map.set(alert.inventoryItemId, [...(map.get(alert.inventoryItemId) ?? []), alert.branchName]);
    }
    return map;
  }, [lowStock]);

  const { data: categoriesData } = useInventoryItemCategories({ limit: 100 });
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const setItemStatus = useSetInventoryItemStatus();
  const createAdjustment = useCreateAdjustment();

  const items = itemsData?.data ?? [];
  const categories = categoriesData?.data ?? [];

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categoriesData?.data ?? []) map.set(category.id, category.name);
    return map;
  }, [categoriesData]);

  const stockByItemId = useMemo(() => {
    const map = new Map<string, number>();
    for (const level of stockLevels ?? []) {
      map.set(level.inventoryItemId, (map.get(level.inventoryItemId) ?? 0) + level.stock);
    }
    return map;
  }, [stockLevels]);

  const totalValue = items.reduce(
    (sum, item) => sum + (stockByItemId.get(item.id) ?? 0) * item.currentCost,
    0,
  );

  const handleFormSubmit = (values: InventoryItemFormValues) => {
    const payload = {
      categoryId: values.categoryId || undefined,
      name: values.name,
      sku: values.sku || undefined,
      unit: values.unit,
      minimumStock: values.minimumStock,
      currentCost: values.currentCost,
    };

    if (editingItem) {
      updateItem.mutate(
        { id: editingItem.id, payload },
        {
          onSuccess: () => {
            enqueueSnackbar('Insumo actualizado correctamente', { variant: 'success' });
            setFormOpen(false);
          },
          onError: (error) =>
            enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
        },
      );
    } else {
      createItem.mutate(payload, {
        onSuccess: () => {
          enqueueSnackbar('Insumo creado correctamente', { variant: 'success' });
          setFormOpen(false);
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      });
    }
  };

  const handleToggleStatus = (item: InventoryItem) => {
    setItemStatus.mutate(
      { id: item.id, isActive: !item.isActive },
      {
        onSuccess: (updated) => {
          enqueueSnackbar(updated.isActive ? 'Insumo activado' : 'Insumo desactivado', {
            variant: 'success',
          });
          setSelectedItem(updated);
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );
  };

  const handleAdjustment = (values: {
    inventoryItemId: string;
    direction: 'IN' | 'OUT';
    quantity: number;
    reason: string;
  }) => {
    if (!branchId) {
      enqueueSnackbar('Tu usuario no tiene una sucursal asignada.', { variant: 'error' });
      return;
    }
    createAdjustment.mutate(
      { branchId, ...values },
      {
        onSuccess: () => {
          enqueueSnackbar('Ajuste registrado correctamente', { variant: 'success' });
          setMovementDrawerOpen(false);
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );
  };

  const columns: ColumnDef<InventoryItem, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Insumo',
      cell: ({ row }) => (
        <Stack>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {row.original.name}
          </Typography>
          {reviewOnly && (
            <Typography variant="caption" color="text.secondary">
              Sede: {branchNames.get(row.original.branchId) ?? '—'}
            </Typography>
          )}
          {row.original.sku && (
            <Typography variant="caption" color="text.secondary">
              Referencia: {row.original.sku}
            </Typography>
          )}
        </Stack>
      ),
    },
    {
      id: 'stock',
      header: 'Stock',
      cell: ({ row }) => {
        const stock = stockByItemId.get(row.original.id) ?? 0;
        const minimum = row.original.minimumStock;
        const ratio = minimum > 0 ? Math.min(1, stock / (minimum * 2)) : 1;
        // Across all branches the total can look fine while one branch is out: go by each branch's alert.
        const lowBranches = reviewOnly ? lowAt.get(row.original.id) : undefined;
        const isLow = reviewOnly ? Boolean(lowBranches) : stock <= minimum;
        return (
          <Stack sx={{ minWidth: 140 }}>
            <Typography variant="caption">
              {reviewOnly
                ? `${stock} ${row.original.unit} entre todas las sedes`
                : `${stock} / mín. ${minimum} ${row.original.unit}`}
            </Typography>
            {lowBranches && (
              <Typography variant="caption" color="error.main">
                Bajo en: {lowBranches.join(', ')}
              </Typography>
            )}
            <LinearProgress
              variant="determinate"
              value={ratio * 100}
              color={isLow ? 'error' : 'success'}
              sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
            />
          </Stack>
        );
      },
    },
    {
      id: 'category',
      header: 'Categoría',
      cell: ({ row }) =>
        row.original.categoryId ? (
          (categoryNameById.get(row.original.categoryId) ?? '—')
        ) : (
          <Typography variant="body2" color="text.secondary">
            Sin categoría
          </Typography>
        ),
    },
    {
      accessorKey: 'currentCost',
      header: 'Costo',
      cell: ({ getValue }) => formatCOP(getValue<number>()),
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
        title="Inventario"
        subtitle="Catálogo de insumos y control de stock."
        breadcrumbs={[{ label: 'Inventario' }]}
        actions={
          <Can permission="inventory.manage">
            <Button
              variant="outlined"
              startIcon={<Tags size={16} />}
              onClick={() => setCategoryManagerOpen(true)}
            >
              Categorías
            </Button>
            {/* An item is created at its branch, not from "Todas las sedes". */}
            {!reviewOnly && (
              <Button
                variant="outlined"
                startIcon={<Plus size={16} />}
                onClick={() => {
                  setEditingItem(null);
                  setFormOpen(true);
                }}
              >
                Nuevo insumo
              </Button>
            )}
            {!reviewOnly && (
              <Button
                variant="contained"
                startIcon={<PackagePlus size={16} />}
                onClick={() => {
                  setMovementDefaultItemId(undefined);
                  setMovementDrawerOpen(true);
                }}
              >
                Ajustar stock
              </Button>
            )}
          </Can>
        }
      />

      <Tabs value={tab} onChange={(_, value: TabKey) => setTab(value)} sx={{ mb: 2 }}>
        <Tab value="inventario" label="Inventario" />
        {specializedQueriesEnabled && <Tab value="consultas" label="Consultas especializadas" />}
      </Tabs>

      {tab === 'consultas' && specializedQueriesEnabled && <SpecializedQueriesTab />}

      {tab === 'inventario' && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <StatCard
                label="Valor total en inventario"
                value={formatCOP(totalValue)}
                icon={Wallet2}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <StatCard label="Insumos activos" value={String(items.length)} icon={Boxes} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <StatCard
                label="Stock bajo el mínimo"
                value={String(lowStock?.length ?? 0)}
                icon={AlertTriangle}
                accent="#D9A441"
              />
            </Grid>
          </Grid>

          <FilterBar
            onClear={() => {
              setSearch('');
              setStatusFilter('activos');
              setCategoryFilter('todas');
            }}
            hasActiveFilters={
              Boolean(search) || statusFilter !== 'activos' || categoryFilter !== 'todas'
            }
          >
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar insumo..." />
            <TextField
              select
              size="small"
              label="Categoría"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="todas">Todas las categorías</MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Estado"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="todos">Todos</MenuItem>
              <MenuItem value="activos">Activos</MenuItem>
              <MenuItem value="inactivos">Inactivos</MenuItem>
            </TextField>
          </FilterBar>

          {isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (
            <DataTable
              columns={columns}
              data={items}
              isLoading={isLoading}
              onRowClick={(item) => setSelectedItem(item)}
              emptyTitle="No hay insumos con estos filtros"
              emptyDescription="Ajusta la búsqueda o los filtros seleccionados."
              pageSize={10}
            />
          )}
        </>
      )}

      <InventoryDetailDrawer
        item={selectedItem}
        categoryName={
          selectedItem?.categoryId ? (categoryNameById.get(selectedItem.categoryId) ?? null) : null
        }
        currentStock={selectedItem ? (stockByItemId.get(selectedItem.id) ?? 0) : 0}
        onClose={() => setSelectedItem(null)}
        onRegisterMovement={(item) => {
          setSelectedItem(null);
          setMovementDefaultItemId(item.id);
          setMovementDrawerOpen(true);
        }}
        onEdit={(item) => {
          setSelectedItem(null);
          setEditingItem(item);
          setFormOpen(true);
        }}
        onToggleStatus={handleToggleStatus}
      />

      <InventoryMovementDrawer
        open={movementDrawerOpen}
        loading={createAdjustment.isPending}
        items={items}
        stockByItemId={stockByItemId}
        defaultItemId={movementDefaultItemId}
        onClose={() => setMovementDrawerOpen(false)}
        onSubmit={handleAdjustment}
      />

      <InventoryItemFormDrawer
        open={formOpen}
        initialItem={editingItem}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      <InventoryCategoryManagerDialog
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
      />
    </>
  );
}
