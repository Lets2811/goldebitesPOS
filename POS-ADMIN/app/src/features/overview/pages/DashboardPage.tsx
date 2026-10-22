import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { ArrowRight, Bot, Building2, CircleDollarSign, FileCheck, ToggleRight, type LucideIcon } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import PageHeader from '../../../shared/components/common/PageHeader';
import { brand } from '../../../shared/theme/palette';
import { formatCOP, formatNumber } from '../../../shared/utils/format';
import { usePlatformFeatureFlags } from '../../../modules/businesses/hooks/use-platform-feature-flags';
import { useBusinessesOverview, useTuraTools, useTuraUsage } from '../../../modules/overview/overview';
import Stat, { StatRow } from '../components/Stat';
import { formatUsd } from '../format';

function SectionCard({
  to,
  icon: Icon,
  title,
  description,
  children,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%', borderRadius: 3 }}>
      <CardActionArea component={RouterLink} to={to} sx={{ height: '100%', p: 2.5, alignItems: 'stretch' }}>
        <Stack spacing={2} sx={{ height: '100%' }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                display: 'grid',
                placeItems: 'center',
                width: 40,
                height: 40,
                borderRadius: 2,
                color: brand.gold,
                bgcolor: alpha(brand.gold, 0.12),
              }}
            >
              <Icon size={20} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {description}
              </Typography>
            </Box>
            <ArrowRight size={18} />
          </Stack>
          <Box sx={{ flex: 1 }}>{children}</Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

/** A figure that is still loading, or could not be read. */
function value<T>(query: { data?: T; isLoading: boolean; isError: boolean }, show: (data: T) => React.ReactNode) {
  if (query.isLoading) return <Skeleton width={60} />;
  if (query.isError || query.data === undefined) return '—';
  return show(query.data);
}

/**
 * The Admin's home: one card per area of the platform, each with its key
 * figures, opening the area's own page.
 */
export default function DashboardPage() {
  const businesses = useBusinessesOverview();
  const flags = usePlatformFeatureFlags();
  const tools = useTuraTools();
  const usage = useTuraUsage(30);
  const list = businesses.data ?? [];

  return (
    <>
      <PageHeader
        title="Panel de administración"
        subtitle="Todo Golden Bites POS de un vistazo: empresas, funcionalidades, TURA, facturación electrónica y costos de la IA."
      />
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(3, 1fr)' } }}>
        <SectionCard
          to="/empresas"
          icon={Building2}
          title="Empresas"
          description="Cada empresa con su información, sedes, usuarios y módulos."
        >
          <StatRow min={110}>
            <Stat label="Empresas" value={value(businesses, (data) => formatNumber(data.length))} />
            <Stat
              label="Activas"
              value={value(businesses, (data) => formatNumber(data.filter((b) => b.isActive).length))}
            />
            <Stat
              label="Ventas 30 días"
              value={value(businesses, (data) => formatCOP(data.reduce((sum, b) => sum + b.last30Days.sales, 0)))}
            />
            <Stat
              label="Sedes"
              value={value(businesses, (data) => formatNumber(data.reduce((sum, b) => sum + b.branches.total, 0)))}
            />
          </StatRow>
        </SectionCard>

        <SectionCard
          to="/feature-flags"
          icon={ToggleRight}
          title="Feature flags"
          description="Funcionalidades encendidas o apagadas para toda la plataforma."
        >
          <StatRow min={110}>
            <Stat label="Encendidas" value={value(flags, (data) => formatNumber(data.filter((f) => f.enabled).length))} />
            <Stat label="Apagadas" value={value(flags, (data) => formatNumber(data.filter((f) => !f.enabled).length))} />
            <Stat label="Total" value={value(flags, (data) => formatNumber(data.length))} />
          </StatRow>
        </SectionCard>

        <SectionCard
          to="/tura"
          icon={Bot}
          title="TURA"
          description="El asistente: sus herramientas y qué empresas lo usan."
        >
          <StatRow min={110}>
            <Stat label="Herramientas" value={value(tools, (data) => formatNumber(data.tools.length))} />
            <Stat
              label="Empresas con TURA"
              value={businesses.isLoading ? <Skeleton width={60} /> : formatNumber(list.filter((b) => b.tura.enabled).length)}
            />
            <Stat
              label="Vinculaciones"
              value={businesses.isLoading ? <Skeleton width={60} /> : formatNumber(list.reduce((sum, b) => sum + b.tura.links, 0))}
            />
          </StatRow>
        </SectionCard>

        <SectionCard
          to="/facturacion"
          icon={FileCheck}
          title="Facturación electrónica"
          description="Conexión de cada empresa con Factus y lo que ha facturado."
        >
          <StatRow min={110}>
            <Stat
              label="Con el módulo"
              value={value(businesses, (data) => formatNumber(data.filter((b) => b.eInvoicing.enabled).length))}
            />
            <Stat
              label="Configuradas"
              value={value(businesses, (data) => formatNumber(data.filter((b) => b.eInvoicing.configured).length))}
            />
            <Stat
              label="Facturas emitidas"
              value={value(businesses, (data) => formatNumber(data.reduce((sum, b) => sum + b.eInvoicing.issued, 0)))}
            />
            <Stat
              label="Fallidas"
              value={value(businesses, (data) => formatNumber(data.reduce((sum, b) => sum + b.eInvoicing.failed, 0)))}
            />
          </StatRow>
        </SectionCard>

        <SectionCard
          to="/costos-ia"
          icon={CircleDollarSign}
          title="Costos de la IA"
          description="Lo que cuesta TURA: gasto, velocidad y gasto por empresa."
        >
          <StatRow min={110}>
            <Stat label="Últimos 30 días" value={value(usage, (data) => formatUsd(data.totals.costUsd))} />
            <Stat label="Conversaciones" value={value(usage, (data) => formatNumber(data.totals.turns))} />
            <Stat
              label="Proyección mensual"
              value={value(usage, (data) => formatUsd(data.totals.projectedMonthlyUsd))}
            />
          </StatRow>
          {usage.isError && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              TURA no respondió: revisa que esté conectado.
            </Typography>
          )}
        </SectionCard>
      </Box>
    </>
  );
}
