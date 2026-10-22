import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import ErrorState from '../../../shared/components/common/ErrorState';
import LoadingSkeleton from '../../../shared/components/common/LoadingSkeleton';
import PageHeader from '../../../shared/components/common/PageHeader';
import StatusChip from '../../../shared/components/common/StatusChip';
import { formatNumber } from '../../../shared/utils/format';
import { useBusinessesOverview, type BusinessOverview } from '../../../modules/overview/overview';
import Stat, { StatRow } from '../components/Stat';
import { formatAgo } from '../format';

function connection(business: BusinessOverview): { label: string; tone: 'success' | 'warning' | 'neutral' | 'info' } {
  const { enabled, configured, environment } = business.eInvoicing;
  if (configured && environment === 'PRODUCTION') return { label: 'Producción', tone: 'success' };
  if (configured) return { label: 'Pruebas', tone: 'info' };
  if (enabled) return { label: 'Falta configurar', tone: 'warning' };
  return { label: 'Sin facturación', tone: 'neutral' };
}

/**
 * Electronic invoicing across the platform: which businesses have it, how
 * they are connected to Factus and what they have invoiced. Each business's
 * Factus account is set up from its own page.
 */
export default function EInvoicingPage() {
  const { data, isLoading, isError, refetch } = useBusinessesOverview();
  const businesses = data ?? [];
  const sum = (pick: (business: BusinessOverview) => number) => businesses.reduce((total, b) => total + pick(b), 0);

  return (
    <>
      <PageHeader
        title="Facturación electrónica"
        subtitle="La conexión de cada empresa con Factus y lo que ha facturado. Configúrala desde la página de cada empresa."
        backTo={{ label: 'Panel', path: '/' }}
      />
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : (
        <>
          <Card variant="outlined" sx={{ borderRadius: 3, p: 2.5, mb: 2.5 }}>
            <StatRow>
              <Stat label="Con el módulo" value={formatNumber(businesses.filter((b) => b.eInvoicing.enabled).length)} />
              <Stat label="Conectadas a Factus" value={formatNumber(businesses.filter((b) => b.eInvoicing.configured).length)} />
              <Stat
                label="En producción"
                value={formatNumber(
                  businesses.filter((b) => b.eInvoicing.configured && b.eInvoicing.environment === 'PRODUCTION').length,
                )}
              />
              <Stat label="Facturas emitidas" value={formatNumber(sum((b) => b.eInvoicing.issued))} />
              <Stat label="Fallidas" value={formatNumber(sum((b) => b.eInvoicing.failed))} />
            </StatRow>
          </Card>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Empresa</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Emitidas</TableCell>
                    <TableCell align="right">Fallidas</TableCell>
                    <TableCell>Última factura</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {businesses.map((business) => {
                    const state = connection(business);
                    return (
                      <TableRow key={business.id}>
                        <TableCell sx={{ fontWeight: 600 }}>{business.name}</TableCell>
                        <TableCell>
                          <StatusChip label={state.label} tone={state.tone} />
                        </TableCell>
                        <TableCell align="right">{formatNumber(business.eInvoicing.issued)}</TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color={business.eInvoicing.failed > 0 ? 'error' : 'text.primary'}
                            sx={{ fontWeight: business.eInvoicing.failed > 0 ? 700 : 400 }}
                          >
                            {formatNumber(business.eInvoicing.failed)}
                          </Typography>
                        </TableCell>
                        <TableCell>{formatAgo(business.eInvoicing.lastIssuedAt, '—')}</TableCell>
                        <TableCell align="right">
                          <Button component={RouterLink} to={`/empresas/${business.id}`} size="small">
                            Ver empresa
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          </Card>
        </>
      )}
    </>
  );
}
