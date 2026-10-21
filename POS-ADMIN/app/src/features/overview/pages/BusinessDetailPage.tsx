import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bot, FileCheck, KeyRound, Settings2, Store } from 'lucide-react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import ErrorState from '../../../shared/components/common/ErrorState';
import LoadingSkeleton from '../../../shared/components/common/LoadingSkeleton';
import StatusChip from '../../../shared/components/common/StatusChip';
import { formatCOP, formatDateCO, formatNumber } from '../../../shared/utils/format';
import { useBusinessDetail, type BusinessDetail } from '../../../modules/overview/overview';
import BusinessBranchesDrawer from '../../businesses/components/BusinessBranchesDrawer';
import BusinessEInvoicingDrawer from '../../businesses/components/BusinessEInvoicingDrawer';
import BusinessFeaturesDrawer from '../../businesses/components/BusinessFeaturesDrawer';
import BusinessMasterKeyDrawer from '../../businesses/components/BusinessMasterKeyDrawer';
import BusinessTuraDrawer from '../../businesses/components/BusinessTuraDrawer';
import Bars from '../components/Bars';
import BusinessLogo from '../components/BusinessLogo';
import Stat, { StatRow } from '../components/Stat';
import { formatAgo } from '../format';

type Drawer = 'modules' | 'branches' | 'invoicing' | 'tura' | 'masterKey';

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <Stack direction="row" sx={{ px: 2.5, pt: 2, pb: 1.5, alignItems: 'center' }}>
        <Typography sx={{ fontWeight: 800, flex: 1 }}>{title}</Typography>
        {action}
      </Stack>
      <Divider />
      <Box sx={{ p: 2.5 }}>{children}</Box>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={2} sx={{ py: 0.75 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 140, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>
        {value || '—'}
      </Typography>
    </Stack>
  );
}

function ManageButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Button size="small" startIcon={icon} onClick={onClick}>
      {label}
    </Button>
  );
}

const shortDay = (date: string) => formatDateCO(`${date}T12:00:00`);

function Content({ business, open }: { business: BusinessDetail; open: (drawer: Drawer) => void }) {
  const enabledModules = business.modules.filter((module) => module.enabled);
  const disabledModules = business.modules.filter((module) => !module.enabled);

  return (
    <Stack spacing={2.5}>
      <Section title="Actividad">
        <StatRow>
          <Stat label="Ventas hoy" value={formatCOP(business.sales.today.sales)} hint={`${business.sales.today.orders} pedidos`} />
          <Stat
            label="Últimos 7 días"
            value={formatCOP(business.sales.last7Days.sales)}
            hint={`${business.sales.last7Days.orders} pedidos`}
          />
          <Stat
            label="Últimos 30 días"
            value={formatCOP(business.last30Days.sales)}
            hint={`${business.last30Days.orders} pedidos`}
          />
          <Stat label="Pedidos en total" value={formatNumber(business.sales.ordersAllTime)} />
          <Stat label="Último pedido" value={formatAgo(business.lastOrderAt)} />
          <Stat label="Último ingreso" value={formatAgo(business.lastLoginAt)} />
        </StatRow>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2.5, mb: 1 }}>
          Ventas por día, últimos 30 días
        </Typography>
        <Bars
          items={business.sales.daily.map((day) => ({
            key: day.date,
            value: day.sales,
            label: `${shortDay(day.date)}: ${formatCOP(day.sales)} · ${day.orders} pedidos`,
          }))}
          empty="Sin ventas en los últimos 30 días"
        />
      </Section>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <Section title="Información">
          <Field label="Nombre" value={business.name} />
          <Field label="Razón social" value={business.legalName} />
          <Field label="NIT" value={business.taxId} />
          <Field label="Correo" value={business.email} />
          <Field label="Teléfono" value={business.phone} />
          <Field label="Moneda" value={business.currency} />
          <Field label="Zona horaria" value={business.timezone} />
          <Field label="Creada" value={formatDateCO(business.createdAt)} />
        </Section>

        <Section title="Catálogo y clientes">
          <StatRow min={120}>
            <Stat label="Productos" value={formatNumber(business.holdings.products)} hint={`${business.holdings.activeProducts} activos`} />
            <Stat label="Insumos" value={formatNumber(business.holdings.inventoryItems)} />
            <Stat label="Clientes" value={formatNumber(business.holdings.customers)} />
            <Stat label="Usuarios activos" value={formatNumber(business.activeUsers)} />
          </StatRow>
        </Section>

        <Section
          title={`Sedes (${business.branches.active} activas de ${business.branches.total})`}
          action={<ManageButton icon={<Store size={14} />} label="Administrar" onClick={() => open('branches')} />}
        >
          <Stack divider={<Divider flexItem />}>
            {business.branchList.map((branch) => (
              <Stack key={branch.id} direction="row" spacing={1} sx={{ py: 1, alignItems: 'center' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {branch.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[branch.address, branch.city].filter(Boolean).join(' · ') || 'Sin dirección'} · {branch.tableCount}{' '}
                    mesas
                  </Typography>
                </Box>
                <StatusChip label={branch.isActive ? 'Activa' : 'Inactiva'} tone={branch.isActive ? 'success' : 'neutral'} />
              </Stack>
            ))}
          </Stack>
        </Section>

        <Section
          title={`Módulos (${enabledModules.length} de ${business.modules.length})`}
          action={<ManageButton icon={<Settings2 size={14} />} label="Administrar" onClick={() => open('modules')} />}
        >
          <Stack direction="row" useFlexGap spacing={0.75} sx={{ flexWrap: 'wrap' }}>
            {enabledModules.map((module) => (
              <Chip key={module.key} size="small" color="success" variant="outlined" label={module.label} />
            ))}
            {disabledModules.map((module) => (
              <Chip key={module.key} size="small" variant="outlined" label={module.label} sx={{ opacity: 0.5 }} />
            ))}
          </Stack>
        </Section>

        <Section
          title="Facturación electrónica"
          action={<ManageButton icon={<FileCheck size={14} />} label="Configurar" onClick={() => open('invoicing')} />}
        >
          <Field label="Módulo" value={business.eInvoicing.enabled ? 'Activo' : 'Apagado'} />
          <Field label="Factus" value={business.eInvoicing.configured ? 'Conectado' : 'Sin configurar'} />
          <Field
            label="Ambiente"
            value={
              business.eInvoicing.environment
                ? business.eInvoicing.environment === 'PRODUCTION'
                  ? 'Producción'
                  : 'Pruebas'
                : null
            }
          />
          <Field label="Facturas emitidas" value={formatNumber(business.eInvoicing.issued)} />
          <Field label="Fallidas" value={formatNumber(business.eInvoicing.failed)} />
          <Field label="Última factura" value={formatAgo(business.eInvoicing.lastIssuedAt)} />
        </Section>

        <Section
          title="TURA y seguridad"
          action={
            <Stack direction="row" spacing={0.5}>
              <ManageButton icon={<Bot size={14} />} label="TURA" onClick={() => open('tura')} />
              <ManageButton icon={<KeyRound size={14} />} label="Llave maestra" onClick={() => open('masterKey')} />
            </Stack>
          }
        >
          <Field label="TURA" value={business.tura.enabled ? 'Activo' : 'Apagado'} />
          <Field label="Vinculaciones" value={formatNumber(business.tura.links)} />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            La llave maestra (para rectificar cajas cerradas) se consulta y cambia en su propio panel.
          </Typography>
        </Section>
      </Box>

      <Section
        title={`Usuarios (${business.users.length})`}
        action={<ManageButton icon={<Settings2 size={14} />} label="Restablecer accesos" onClick={() => open('modules')} />}
      >
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Correo</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {business.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {user.firstName} {user.lastName}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.roleName}</TableCell>
                  <TableCell>
                    <StatusChip
                      label={user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      tone={user.status === 'ACTIVE' ? 'success' : 'neutral'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Section>
    </Stack>
  );
}

/** Everything the platform knows about one business, with the panels to administer it. */
export default function BusinessDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { data: business, isLoading, isError, refetch } = useBusinessDetail(id);
  const [drawer, setDrawer] = useState<Drawer | null>(null);

  const close = () => {
    setDrawer(null);
    // What was changed in a panel shows up here and in the lists.
    void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
  };
  const ref = business ? { id: business.id, name: business.name } : null;
  const opened = (which: Drawer) => (drawer === which ? ref : null);

  return (
    <>
      <Button component={RouterLink} to="/empresas" size="small" startIcon={<ArrowLeft size={16} />} sx={{ mb: 1, ml: -1 }}>
        Volver a Empresas
      </Button>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading || !business ? (
        <LoadingSkeleton variant="page" />
      ) : (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3, alignItems: { sm: 'center' } }}>
            <BusinessLogo business={business} size={72} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {business.name}
                </Typography>
                <StatusChip label={business.isActive ? 'Activa' : 'Inactiva'} tone={business.isActive ? 'success' : 'neutral'} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {business.legalName ?? 'Sin razón social'} · Cliente desde {formatDateCO(business.createdAt)}
              </Typography>
            </Box>
          </Stack>
          <Content business={business} open={setDrawer} />
        </>
      )}

      <BusinessFeaturesDrawer business={opened('modules')} onClose={close} />
      <BusinessBranchesDrawer business={opened('branches')} onClose={close} />
      <BusinessEInvoicingDrawer business={opened('invoicing')} onClose={close} />
      <BusinessTuraDrawer business={opened('tura')} onClose={close} />
      <BusinessMasterKeyDrawer business={opened('masterKey')} onClose={close} />
    </>
  );
}
