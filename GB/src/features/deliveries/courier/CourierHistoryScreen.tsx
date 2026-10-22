import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import StatusChip from '../../../components/common/StatusChip';
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_TONES,
  formatDistance,
} from '../../../modules/deliveries/delivery-pricing';
import { useMyDeliveries } from '../../../modules/deliveries/hooks/use-deliveries';
import { formatCOP, formatDateTimeCO } from '../../../utils/format';
import { PERIOD_LABELS, periodStart, type CourierPeriod } from './courier-periods';

/** The courier's finished deliveries (delivered or cancelled). */
export default function CourierHistoryScreen() {
  const [period, setPeriod] = useState<CourierPeriod>('today');
  const { data: deliveries = [], isLoading } = useMyDeliveries('history', periodStart(period));

  return (
    <Stack spacing={1.5} sx={{ p: 2, maxWidth: 640, width: '100%', mx: 'auto' }}>
      <ToggleButtonGroup exclusive fullWidth value={period} onChange={(_e, value: CourierPeriod | null) => value && setPeriod(value)}>
        {(Object.keys(PERIOD_LABELS) as CourierPeriod[]).map((key) => (
          <ToggleButton key={key} value={key}>
            {PERIOD_LABELS[key]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {isLoading && <LoadingSkeleton />}
      {!isLoading && deliveries.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No hay domicilios terminados en este periodo.
        </Typography>
      )}
      {deliveries.map((delivery) => (
        <Card key={delivery.id} sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }} noWrap>
                {delivery.destination.address}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDateTimeCO(delivery.deliveredAt ?? delivery.cancelledAt ?? delivery.createdAt)} ·{' '}
                {formatDistance(delivery.distanceMeters)}
                {delivery.customerName ? ` · ${delivery.customerName}` : ''}
              </Typography>
            </Box>
            <Stack sx={{ alignItems: 'flex-end', flexShrink: 0 }} spacing={0.5}>
              <Typography sx={{ fontWeight: 700 }}>{formatCOP(delivery.fee)}</Typography>
              <StatusChip label={DELIVERY_STATUS_LABELS[delivery.status]} tone={DELIVERY_STATUS_TONES[delivery.status]} />
            </Stack>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
