import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import ErrorState from '../../../shared/components/common/ErrorState';
import LoadingSkeleton from '../../../shared/components/common/LoadingSkeleton';
import PageHeader from '../../../shared/components/common/PageHeader';
import StatusChip from '../../../shared/components/common/StatusChip';
import { normalizeApiError } from '../../../shared/lib/api/api-error';
import { formatDateTimeCO, formatNumber } from '../../../shared/utils/format';
import { useBusinessesOverview, useTuraUsage, type TuraUsage } from '../../../modules/overview/overview';
import Bars from '../components/Bars';
import Stat, { StatRow } from '../components/Stat';
import { formatSeconds, formatUsd } from '../format';

const PERIODS = [1, 7, 30, 90];
const MODES: Record<string, string> = { chat: 'Chat', voice: 'Voz', introduction: 'Voz' };
const OUTCOMES = {
  ok: { label: 'OK', tone: 'success' },
  error: { label: 'Falló', tone: 'error' },
  cancelled: { label: 'Cancelada', tone: 'neutral' },
} as const;

const shortModel = (model: string) => model.replace(/^claude-/, '');

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <Typography sx={{ fontWeight: 800, px: 2.5, pt: 2, pb: 1.5 }}>{title}</Typography>
      <Divider />
      <Box sx={{ p: 2.5, overflowX: 'auto' }}>{children}</Box>
    </Card>
  );
}

function GroupTable({
  unit,
  groups,
  label,
}: {
  unit: string;
  groups: TuraUsage['byModel'];
  label: (key: string) => string;
}) {
  if (groups.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Sin uso en el período
      </Typography>
    );
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell />
          <TableCell align="right">{unit}</TableCell>
          <TableCell align="right">Entrada</TableCell>
          <TableCell align="right">Salida</TableCell>
          <TableCell align="right">Costo</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {groups.map((group) => (
          <TableRow key={group.key}>
            <TableCell sx={{ fontWeight: 600 }}>{label(group.key)}</TableCell>
            <TableCell align="right">{formatNumber(group.turns)}</TableCell>
            <TableCell align="right">{formatNumber(group.inputTokens)}</TableCell>
            <TableCell align="right">{formatNumber(group.outputTokens)}</TableCell>
            <TableCell align="right">{formatUsd(group.costUsd)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Usage({ usage }: { usage: TuraUsage }) {
  const { data: businesses } = useBusinessesOverview();
  const businessName = (key: string) =>
    key === 'unknown'
      ? 'Sin empresa (registros anteriores)'
      : (businesses?.find((business) => business.id === key)?.name ?? key);
  const { totals, latency } = usage;

  return (
    <Stack spacing={2.5}>
      <Card variant="outlined" sx={{ borderRadius: 3, p: 2.5 }}>
        <StatRow min={150}>
          <Stat label="Gasto" value={formatUsd(totals.costUsd)} hint={`modelo actual: ${shortModel(usage.currentModel)}`} />
          <Stat label="Proyección mensual" value={formatUsd(totals.projectedMonthlyUsd)} hint="al ritmo del período" />
          <Stat label="Por conversación" value={formatUsd(totals.costPerTurnUsd)} />
          <Stat
            label="Conversaciones"
            value={formatNumber(totals.turns)}
            hint={`${formatNumber(totals.withTools)} con consultas · ${formatNumber(totals.errors)} fallidas`}
          />
          <Stat label="Primera palabra" value={formatSeconds(latency.firstTextMs)} hint={`lentas: ${formatSeconds(latency.firstTextSlowMs)}`} />
          <Stat label="Respuesta completa" value={formatSeconds(latency.totalMs)} />
          <Stat
            label="Tokens"
            value={formatNumber(totals.inputTokens + totals.outputTokens)}
            hint={`${formatNumber(totals.cacheReadTokens)} desde caché`}
          />
        </StatRow>
        {usage.unpricedModels.length > 0 && (
          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1.5 }}>
            Sin precio conocido (no suman al gasto): {usage.unpricedModels.join(', ')}
          </Typography>
        )}
      </Card>

      <Section title="Gasto por día">
        <Bars
          items={[...usage.byDay].reverse().map((day) => ({
            key: day.key,
            value: day.costUsd,
            label: `${day.key}: ${formatUsd(day.costUsd)} · ${day.turns} conversaciones`,
          }))}
        />
      </Section>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <Section title="Por empresa">
          <GroupTable unit="Conversaciones" groups={usage.byBusiness ?? []} label={businessName} />
        </Section>
        <Section title="Por modo">
          <GroupTable unit="Conversaciones" groups={usage.byMode} label={(key) => MODES[key] ?? key} />
        </Section>
        <Section title="Por modelo">
          <GroupTable unit="Peticiones" groups={usage.byModel} label={shortModel} />
        </Section>
        <Section title="El mismo uso en otros modelos">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Modelo</TableCell>
                <TableCell align="right">Precio (entrada / salida por millón)</TableCell>
                <TableCell align="right">Costo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usage.whatIf.map((option) => (
                <TableRow key={option.model}>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {shortModel(option.model)}
                    {option.model === usage.currentModel ? ' (actual)' : ''}
                  </TableCell>
                  <TableCell align="right">
                    {option.price ? `US$ ${option.price.input} / ${option.price.output}` : '—'}
                  </TableCell>
                  <TableCell align="right">{formatUsd(option.costUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Otro modelo no usaría exactamente los mismos tokens: es una guía, no una cotización.
          </Typography>
        </Section>
      </Box>

      <Section title="Últimas conversaciones">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Cuándo</TableCell>
              <TableCell>Modo</TableCell>
              <TableCell>Resultado</TableCell>
              <TableCell>Herramientas</TableCell>
              <TableCell align="right">Tokens</TableCell>
              <TableCell align="right">1.ª palabra</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Costo</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usage.recent.map((turn) => (
              <TableRow key={turn.at}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTimeCO(turn.at)}</TableCell>
                <TableCell>{MODES[turn.mode] ?? turn.mode}</TableCell>
                <TableCell>
                  <StatusChip label={OUTCOMES[turn.outcome].label} tone={OUTCOMES[turn.outcome].tone} />
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{turn.tools.join(', ') || '—'}</TableCell>
                <TableCell align="right">{formatNumber(turn.inputTokens + turn.outputTokens)}</TableCell>
                <TableCell align="right">{formatSeconds(turn.firstTextMs)}</TableCell>
                <TableCell align="right">{formatSeconds(turn.totalMs)}</TableCell>
                <TableCell align="right">{formatUsd(turn.costUsd)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </Stack>
  );
}

/**
 * What the AI (TURA) costs to run: spend, speed, spend by business, and what
 * the same use would cost on another model. Read by the Admin's server with
 * TURA's admin key, so it needs no password here.
 */
export default function AiCostsPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, isError, error, refetch } = useTuraUsage(days);

  return (
    <>
      <PageHeader
        title="Costos de la IA"
        subtitle="Lo que cuesta TURA: gasto, velocidad, gasto por empresa y lo que costaría en otro modelo."
        backTo={{ label: 'Panel', path: '/' }}
        actions={
          <ToggleButtonGroup
            size="small"
            exclusive
            value={days}
            onChange={(_event, value: number | null) => value && setDays(value)}
          >
            {PERIODS.map((period) => (
              <ToggleButton key={period} value={period} sx={{ px: 1.5 }}>
                {period === 1 ? 'Hoy' : `${period} días`}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        }
      />
      {isError ? (
        <ErrorState title={normalizeApiError(error).message} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <LoadingSkeleton variant="page" />
      ) : (
        <Usage usage={data} />
      )}
    </>
  );
}
