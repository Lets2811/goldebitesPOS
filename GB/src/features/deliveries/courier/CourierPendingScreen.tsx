import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Play } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { normalizeApiError } from '../../../lib/api/api-error';
import { formatDistance } from '../../../modules/deliveries/delivery-pricing';
import { useAdvanceOwnDelivery } from '../../../modules/deliveries/hooks/use-deliveries';
import type { Delivery } from '../../../modules/deliveries/types/delivery.types';
import { formatTimeCO } from '../../../utils/format';

/** Deliveries assigned to the courier and not started yet: start one to ride it. */
export default function CourierPendingScreen({
  deliveries,
  onStarted,
}: {
  deliveries: Delivery[];
  onStarted: (deliveryId: string) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const advance = useAdvanceOwnDelivery();

  if (deliveries.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>
        No tienes domicilios pendientes. Cuando te asignen uno, aparece aquí.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5} sx={{ p: 2, maxWidth: 640, width: '100%', mx: 'auto' }}>
      {deliveries.map((delivery) => (
        <Card key={delivery.id} sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }}>{delivery.destination.address}</Typography>
          {delivery.destination.details && <Typography variant="body2">{delivery.destination.details}</Typography>}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {[
              delivery.customerName,
              formatDistance(delivery.distanceMeters),
              `Sale de ${delivery.branchName}`,
              delivery.assignedAt && `asignado ${formatTimeCO(delivery.assignedAt)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
          {delivery.notes && (
            <Typography variant="body2" sx={{ mt: 1, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
              {delivery.notes}
            </Typography>
          )}
          <Box sx={{ mt: 1.5 }}>
            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={<Play size={18} />}
              loading={advance.isPending && advance.variables?.id === delivery.id}
              onClick={() =>
                advance.mutate(
                  { id: delivery.id, status: 'IN_TRANSIT' },
                  {
                    onSuccess: () => onStarted(delivery.id),
                    onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
                  },
                )
              }
            >
              Iniciar ruta
            </Button>
          </Box>
        </Card>
      ))}
    </Stack>
  );
}
