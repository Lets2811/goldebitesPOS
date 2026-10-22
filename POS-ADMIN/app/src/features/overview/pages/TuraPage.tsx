import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { Eye, PencilLine } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import ErrorState from '../../../shared/components/common/ErrorState';
import LoadingSkeleton from '../../../shared/components/common/LoadingSkeleton';
import PageHeader from '../../../shared/components/common/PageHeader';
import StatusChip from '../../../shared/components/common/StatusChip';
import { normalizeApiError } from '../../../shared/lib/api/api-error';
import { formatNumber } from '../../../shared/utils/format';
import { useBusinessesOverview, useTuraTools } from '../../../modules/overview/overview';
import Stat, { StatRow } from '../components/Stat';

/** "consultar_productos" → "Consultar productos". */
function toolTitle(name: string): string {
  const words = name.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function Tools() {
  const { data, isLoading, isError, error, refetch } = useTuraTools();
  if (isLoading) return <LoadingSkeleton variant="list" />;
  if (isError || !data) {
    return <ErrorState title={normalizeApiError(error).message} onRetry={() => refetch()} />;
  }
  const reads = data.tools.filter((tool) => tool.kind === 'read').length;
  return (
    <Stack spacing={2.5}>
      <StatRow>
        <Stat label="Herramientas" value={formatNumber(data.tools.length)} />
        <Stat label="De consulta" value={formatNumber(reads)} />
        <Stat label="De cambios" value={formatNumber(data.tools.length - reads)} />
        <Stat label="Modelo" value={<Typography sx={{ fontWeight: 800 }}>{data.model.replace(/^claude-/, '')}</Typography>} />
      </StatRow>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))' }}>
        {data.tools.map((tool) => (
          <Card key={tool.name} variant="outlined" sx={{ borderRadius: 3, p: 2.25 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
              {tool.kind === 'read' ? <Eye size={16} /> : <PencilLine size={16} />}
              <Typography sx={{ fontWeight: 800, flex: 1 }}>{toolTitle(tool.name)}</Typography>
              <StatusChip label={tool.kind === 'read' ? 'Consulta' : 'Cambio'} tone={tool.kind === 'read' ? 'info' : 'warning'} />
            </Stack>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
              {tool.name} · permiso {tool.permission}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-line' }}>
              {tool.description}
            </Typography>
          </Card>
        ))}
      </Box>
    </Stack>
  );
}

function Businesses() {
  const { data, isLoading } = useBusinessesOverview();
  if (isLoading || !data) return <LoadingSkeleton variant="table" rows={3} />;
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Empresa</TableCell>
            <TableCell>TURA</TableCell>
            <TableCell align="right">Vinculaciones</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((business) => (
            <TableRow key={business.id}>
              <TableCell sx={{ fontWeight: 600 }}>{business.name}</TableCell>
              <TableCell>
                <StatusChip label={business.tura.enabled ? 'Activo' : 'Apagado'} tone={business.tura.enabled ? 'gold' : 'neutral'} />
              </TableCell>
              <TableCell align="right">{formatNumber(business.tura.links)}</TableCell>
              <TableCell align="right">
                <Button component={RouterLink} to={`/empresas/${business.id}`} size="small">
                  Ver empresa
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

/** TURA, the assistant: the tools it has and which businesses use it. */
export default function TuraPage() {
  return (
    <>
      <PageHeader
        title="TURA"
        subtitle="Las herramientas del asistente (lo que puede consultar y cambiar en el POS) y qué empresas lo usan."
        backTo={{ label: 'Panel', path: '/' }}
        actions={
          <Button component={RouterLink} to="/costos-ia" variant="outlined">
            Ver costos de la IA
          </Button>
        }
      />
      <Stack spacing={3}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
            Herramientas
          </Typography>
          <Tools />
        </Box>
        <Divider />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
            Empresas
          </Typography>
          <Businesses />
        </Box>
      </Stack>
    </>
  );
}
