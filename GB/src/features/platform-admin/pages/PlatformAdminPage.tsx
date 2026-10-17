import { useState } from 'react';
import Button from '@mui/material/Button';
import type { ColumnDef } from '@tanstack/react-table';
import Stack from '@mui/material/Stack';
import { Plus, Settings2, Store, FileCheck, Bot } from 'lucide-react';
import { useSnackbar } from 'notistack';
import PageHeader from '../../../components/common/PageHeader';
import DataTable from '../../../components/common/DataTable';
import ErrorState from '../../../components/common/ErrorState';
import StatusChip from '../../../components/common/StatusChip';
import DateDisplay from '../../../components/common/DateDisplay';
import { usePlatformBusinesses } from '../../../modules/platform-admin/hooks/use-platform-businesses';
import { useCreatePlatformBusiness } from '../../../modules/platform-admin/hooks/use-create-platform-business';
import { normalizeApiError } from '../../../lib/api/api-error';
import type { Business } from '../../../modules/platform-admin/types/platform-admin.types';
import type { CreateBusinessFormValues } from '../schemas/createBusinessSchema';
import CreateBusinessDialog from '../components/CreateBusinessDialog';
import BusinessBranchesDrawer from '../components/BusinessBranchesDrawer';
import BusinessFeaturesDrawer from '../components/BusinessFeaturesDrawer';
import BusinessEInvoicingDrawer from '../components/BusinessEInvoicingDrawer';
import BusinessTuraDrawer from '../components/BusinessTuraDrawer';

export default function PlatformAdminPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [branchesOf, setBranchesOf] = useState<Business | null>(null);
  const [eInvoicingOf, setEInvoicingOf] = useState<Business | null>(null);
  const [turaOf, setTuraOf] = useState<Business | null>(null);

  const { data: businesses, isLoading, isError, refetch } = usePlatformBusinesses();
  const createBusiness = useCreatePlatformBusiness();

  const handleCreate = (values: CreateBusinessFormValues) => {
    createBusiness.mutate(values, {
      onSuccess: () => {
        enqueueSnackbar('Empresa creada correctamente', { variant: 'success' });
        setCreateOpen(false);
      },
      onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
    });
  };

  const columns: ColumnDef<Business, unknown>[] = [
    { accessorKey: 'name', header: 'Empresa' },
    { id: 'currency', header: 'Moneda', cell: ({ row }) => row.original.currency },
    {
      id: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <StatusChip
          label={row.original.isActive ? 'Activa' : 'Inactiva'}
          tone={row.original.isActive ? 'success' : 'neutral'}
        />
      ),
    },
    {
      id: 'createdAt',
      header: 'Creada',
      cell: ({ row }) => <DateDisplay value={row.original.createdAt} variant="body2" />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <Button
            size="small"
            startIcon={<Settings2 size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedBusiness(row.original);
            }}
          >
            Módulos
          </Button>
          <Button
            size="small"
            startIcon={<Store size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              setBranchesOf(row.original);
            }}
          >
            Sedes
          </Button>
          <Button
            size="small"
            startIcon={<FileCheck size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              setEInvoicingOf(row.original);
            }}
          >
            Facturación
          </Button>
          <Button
            size="small"
            startIcon={<Bot size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              setTuraOf(row.original);
            }}
          >
            TURA
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Administración de plataforma"
        subtitle="Empresas que usan Golden Bites POS, qué módulos tiene activos cada una y cuántas sedes."
        breadcrumbs={[{ label: 'Plataforma' }]}
        actions={
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            Nueva empresa
          </Button>
        }
      />

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={businesses ?? []}
          isLoading={isLoading}
          onRowClick={(row) => setSelectedBusiness(row)}
          emptyTitle="Todavía no hay empresas registradas"
          pageSize={20}
        />
      )}

      <CreateBusinessDialog
        open={createOpen}
        loading={createBusiness.isPending}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <BusinessFeaturesDrawer business={selectedBusiness} onClose={() => setSelectedBusiness(null)} />
      <BusinessBranchesDrawer business={branchesOf} onClose={() => setBranchesOf(null)} />
      <BusinessEInvoicingDrawer business={eInvoicingOf} onClose={() => setEInvoicingOf(null)} />
      <BusinessTuraDrawer business={turaOf} onClose={() => setTuraOf(null)} />
    </>
  );
}
