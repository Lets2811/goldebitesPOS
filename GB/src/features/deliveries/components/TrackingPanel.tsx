import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import StatusChip from '../../../components/common/StatusChip';
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_TONES } from '../../../modules/deliveries/delivery-pricing';
import { useCourierTracking } from '../../../modules/deliveries/hooks/use-deliveries';
import type { CourierTracking } from '../../../modules/deliveries/types/delivery.types';
import { initialsFromName } from '../../../utils/format';
import DeliveryMap, { type MapMarker } from './DeliveryMap';

const STALE_MS = 5 * 60 * 1000;
const DESTINATION_COLOR = '#C9A227';

/** `now` is when the data arrived, so rendering stays pure. */
function lastSeen(courier: CourierTracking, now: number): string {
  if (!courier.location) return 'Sin ubicación todavía';
  const minutes = Math.round((now - new Date(courier.location.recordedAt).getTime()) / 60_000);
  return minutes < 1 ? 'Ubicación en vivo' : `Visto hace ${minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`}`;
}

/**
 * Where every courier is (as their phone last reported), what they carry,
 * and the path ridden on each delivery on its way. Refreshed every 10 s.
 */
export default function TrackingPanel() {
  const { data: couriers = [], isLoading, dataUpdatedAt: now } = useCourierTracking(true);
  const [focusId, setFocusId] = useState<string | null>(null);
  const shown = focusId ? couriers.filter((c) => c.courierId === focusId) : couriers;

  const markers = useMemo<MapMarker[]>(
    () =>
      shown.flatMap((courier) => [
        ...(courier.location
          ? [
              {
                id: `courier-${courier.courierId}`,
                position: courier.location,
                label: initialsFromName(courier.name),
                title: `${courier.name} · ${lastSeen(courier, now)}`,
                color: now - new Date(courier.location.recordedAt).getTime() > STALE_MS ? '#8A8A8A' : undefined,
              },
            ]
          : []),
        ...courier.deliveries.map((delivery) => ({
          id: `destination-${delivery.id}`,
          position: delivery.destination,
          label: 'B',
          title: `${delivery.trackingCode} · ${courier.name} → ${delivery.destination.address}`,
          color: DESTINATION_COLOR,
        })),
      ]),
    [shown, now],
  );
  const trails = useMemo(() => shown.flatMap((c) => c.deliveries.map((d) => d.trail)), [shown]);
  const fitKey = shown.map((c) => `${c.courierId}:${c.location ? 1 : 0}:${c.deliveries.length}`).join('|');

  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card sx={{ p: 1 }}>
          {!isLoading && couriers.length === 0 && (
            <Alert severity="info" sx={{ m: 1 }}>
              No hay usuarios con el rol Domiciliario.
            </Alert>
          )}
          <List disablePadding>
            {couriers.map((courier) => (
              <ListItemButton
                key={courier.courierId}
                selected={courier.courierId === focusId}
                onClick={() => setFocusId((current) => (current === courier.courierId ? null : courier.courierId))}
                sx={{ borderRadius: 1, display: 'block' }}
              >
                <Typography sx={{ fontWeight: 700 }}>{courier.name}</Typography>
                <Typography variant="caption" color="text.secondary" component="p">
                  {lastSeen(courier, now)}
                </Typography>
                {courier.deliveries.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    Sin domicilios abiertos
                  </Typography>
                ) : (
                  <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                    {courier.deliveries.map((delivery) => (
                      <Stack key={delivery.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <StatusChip
                          label={DELIVERY_STATUS_LABELS[delivery.status]}
                          tone={DELIVERY_STATUS_TONES[delivery.status]}
                        />
                        <Typography variant="caption" noWrap title={delivery.destination.address}>
                          <strong>{delivery.trackingCode}</strong> · {delivery.customerName ?? delivery.destination.address}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </ListItemButton>
            ))}
          </List>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        <DeliveryMap origin={null} markers={markers} trails={trails} fitKey={fitKey} height={560} />
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Los domiciliarios comparten su ubicación mientras tienen la app abierta con domicilios asignados. En gris:
            sin reportar hace más de 5 minutos. Toca un domiciliario para ver solo el suyo.
          </Typography>
        </Box>
      </Grid>
    </Grid>
  );
}
