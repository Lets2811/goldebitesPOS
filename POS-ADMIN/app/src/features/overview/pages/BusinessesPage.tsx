import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ArrowRight, Plus, Search } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { Link as RouterLink } from 'react-router-dom';
import PageHeader from '../../../shared/components/common/PageHeader';
import EmptyState from '../../../shared/components/common/EmptyState';
import ErrorState from '../../../shared/components/common/ErrorState';
import LoadingSkeleton from '../../../shared/components/common/LoadingSkeleton';
import StatusChip from '../../../shared/components/common/StatusChip';
import { normalizeApiError } from '../../../shared/lib/api/api-error';
import { formatCOP, formatNumber } from '../../../shared/utils/format';
import { useCreatePlatformBusiness } from '../../../modules/businesses/hooks/use-create-platform-business';
import { useBusinessesOverview, type BusinessOverview } from '../../../modules/overview/overview';
import CreateBusinessDialog from '../../businesses/components/CreateBusinessDialog';
import type { CreateBusinessFormValues } from '../../businesses/schemas/createBusinessSchema';
import BusinessLogo from '../components/BusinessLogo';
import Stat, { StatRow } from '../components/Stat';
import { formatAgo } from '../format';

function BusinessCard({ business }: { business: BusinessOverview }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" spacing={2} sx={{ p: 2.5, alignItems: 'center' }}>
        <BusinessLogo business={business} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 17 }} noWrap>
            {business.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {business.legalName ?? 'Sin razón social'}
          </Typography>
        </Box>
        <StatusChip label={business.isActive ? 'Activa' : 'Inactiva'} tone={business.isActive ? 'success' : 'neutral'} />
      </Stack>
      <Divider />
      <Box sx={{ p: 2.5, flex: 1 }}>
        <StatRow min={100}>
          <Stat label="Ventas 30 días" value={formatCOP(business.last30Days.sales)} />
          <Stat label="Pedidos 30 días" value={formatNumber(business.last30Days.orders)} />
          <Stat label="Sedes" value={`${business.branches.active}/${business.branches.total}`} />
          <Stat label="Usuarios" value={formatNumber(business.activeUsers)} />
        </StatRow>
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ mt: 2, flexWrap: 'wrap' }}>
          <StatusChip label={`${business.enabledModules} módulos`} tone="info" />
          <StatusChip
            label={business.tura.enabled ? `TURA · ${business.tura.links} vinc.` : 'Sin TURA'}
            tone={business.tura.enabled ? 'gold' : 'neutral'}
          />
          <StatusChip
            label={
              business.eInvoicing.configured
                ? `Factus ${business.eInvoicing.environment === 'PRODUCTION' ? 'producción' : 'pruebas'}`
                : 'Sin facturación'
            }
            tone={business.eInvoicing.configured ? 'success' : 'neutral'}
          />
        </Stack>
      </Box>
      <Divider />
      <Stack direction="row" sx={{ px: 2.5, py: 1.5, alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          Último pedido: {formatAgo(business.lastOrderAt)}
        </Typography>
        <Button
          component={RouterLink}
          to={`/empresas/${business.id}`}
          variant="contained"
          size="small"
          endIcon={<ArrowRight size={16} />}
        >
          Ver empresa
        </Button>
      </Stack>
    </Card>
  );
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Every business on the platform as a card, each opening its own page. */
export default function BusinessesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch } = useBusinessesOverview();
  const createBusiness = useCreatePlatformBusiness();

  const handleCreate = (values: CreateBusinessFormValues) => {
    createBusiness.mutate(values, {
      onSuccess: () => {
        enqueueSnackbar('Empresa creada correctamente', { variant: 'success' });
        setCreateOpen(false);
        void refetch();
      },
      onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
    });
  };

  const wanted = normalize(search.trim());
  const businesses = (data ?? []).filter(
    (business) => !wanted || normalize(`${business.name} ${business.legalName ?? ''}`).includes(wanted),
  );

  return (
    <>
      <PageHeader
        title="Empresas"
        subtitle="Las empresas que usan Golden Bites POS. Abre una para ver toda su información y administrarla."
        backTo={{ label: 'Panel', path: '/' }}
        actions={
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            Nueva empresa
          </Button>
        }
      />

      <TextField
        size="small"
        placeholder="Buscar empresa"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        sx={{ mb: 2.5, width: { xs: '100%', sm: 320 } }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search size={16} />
              </InputAdornment>
            ),
          },
        }}
      />

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <LoadingSkeleton variant="cards" />
      ) : businesses.length === 0 ? (
        <EmptyState title={search ? 'Ninguna empresa coincide' : 'Todavía no hay empresas registradas'} />
      ) : (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}>
          {businesses.map((business) => (
            <BusinessCard key={business.id} business={business} />
          ))}
        </Box>
      )}

      <CreateBusinessDialog
        open={createOpen}
        loading={createBusiness.isPending}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </>
  );
}
