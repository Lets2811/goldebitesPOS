import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import { formatDistance } from '../../../modules/deliveries/delivery-pricing';
import { useMyBalance } from '../../../modules/deliveries/hooks/use-deliveries';
import { formatCOP } from '../../../utils/format';
import { PERIOD_LABELS, periodStart, type CourierPeriod } from './courier-periods';

function Figure({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 800, color: accent ? 'primary.main' : 'text.primary' }}>
        {value}
      </Typography>
    </Card>
  );
}

/** What the courier delivered in the period: how many, how far, and what those deliveries were worth. */
export default function CourierBalanceScreen() {
  const [period, setPeriod] = useState<CourierPeriod>('today');
  const { data: balance, isLoading } = useMyBalance(periodStart(period));

  return (
    <Stack spacing={1.5} sx={{ p: 2, maxWidth: 640, width: '100%', mx: 'auto' }}>
      <ToggleButtonGroup exclusive fullWidth value={period} onChange={(_e, value: CourierPeriod | null) => value && setPeriod(value)}>
        {(Object.keys(PERIOD_LABELS) as CourierPeriod[]).map((key) => (
          <ToggleButton key={key} value={key}>
            {PERIOD_LABELS[key]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {isLoading || !balance ? (
        <LoadingSkeleton />
      ) : (
        <>
          <Figure label="Valor de domicilios entregados" value={formatCOP(balance.fees)} accent />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Figure label="Entregados" value={String(balance.delivered)} />
            <Figure label="Recorrido" value={formatDistance(balance.distanceMeters)} />
            <Figure label="Cancelados" value={String(balance.cancelled)} />
            <Figure
              label="Promedio por domicilio"
              value={balance.delivered > 0 ? formatCOP(Math.round(balance.fees / balance.delivered)) : '—'}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            Es la suma de lo que se cobró por cada domicilio que entregaste. Lo que te corresponde a ti lo define el
            negocio.
          </Typography>
        </>
      )}
    </Stack>
  );
}
