import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useLinkDeliveryOrder } from '../../../modules/deliveries/hooks/use-deliveries';
import type { Delivery, LinkableOrder } from '../../../modules/deliveries/types/delivery.types';
import OrderPicker from './OrderPicker';

/**
 * Links a delivery that already exists to an order of the POS (or changes or
 * removes the link): the order is often rung up after the delivery went out.
 * The customer then sees the order's detail on their tracking page.
 */
export default function LinkOrderDialog({ delivery, onClose }: { delivery: Delivery | null; onClose: () => void }) {
  return delivery ? <LinkOrderContent key={delivery.id} delivery={delivery} onClose={onClose} /> : null;
}

function LinkOrderContent({ delivery, onClose }: { delivery: Delivery; onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const link = useLinkDeliveryOrder();
  const [order, setOrder] = useState<LinkableOrder | null>(null);

  const save = (orderId: string | null) =>
    link.mutate(
      { id: delivery.id, orderId },
      {
        onSuccess: (updated) => {
          enqueueSnackbar(
            updated.orderNumber ? `Domicilio vinculado al pedido #${updated.orderNumber}` : 'Pedido desvinculado',
            { variant: 'success' },
          );
          onClose();
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{delivery.orderNumber ? 'Cambiar el pedido del domicilio' : 'Vincular a un pedido'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {delivery.destination.address}
            {delivery.customerName ? ` · ${delivery.customerName}` : ''} · código {delivery.trackingCode}
          </Typography>
          {delivery.orderNumber && (
            <Alert severity="info">
              Vinculado al pedido <strong>#{delivery.orderNumber}</strong>. Elige otro para cambiarlo, o desvincúlalo.
            </Alert>
          )}
          <OrderPicker value={order} onChange={setOrder} label="Pedido" autoFocus />
          <Typography variant="caption" color="text.secondary">
            El cliente verá el detalle y los costos de ese pedido en su enlace de seguimiento. El valor del domicilio no
            cambia el total del pedido en caja.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        {delivery.orderNumber && (
          <Button color="error" onClick={() => save(null)} disabled={link.isPending} sx={{ mr: 'auto' }}>
            Desvincular
          </Button>
        )}
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={!order} loading={link.isPending} onClick={() => order && save(order.id)}>
          Vincular
        </Button>
      </DialogActions>
    </Dialog>
  );
}
