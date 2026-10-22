import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { X } from 'lucide-react';
import StatusChip from '../../../components/common/StatusChip';
import type { PublicTracking } from '../../../modules/deliveries/types/delivery.types';
import { formatCOP, formatNumber } from '../../../utils/format';

const PAYMENT_LABELS: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  PAID: { label: 'Pagado', tone: 'success' },
  PARTIALLY_PAID: { label: 'Pago parcial', tone: 'warning' },
  PENDING: { label: 'Pendiente de pago', tone: 'warning' },
  REFUNDED: { label: 'Reembolsado', tone: 'neutral' },
  CANCELLED: { label: 'Cancelado', tone: 'neutral' },
};

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
      <Typography variant={strong ? 'subtitle1' : 'body2'} color={muted ? 'text.secondary' : 'text.primary'} sx={{ fontWeight: strong ? 800 : 400 }}>
        {label}
      </Typography>
      <Typography variant={strong ? 'subtitle1' : 'body2'} color={muted ? 'text.secondary' : 'text.primary'} sx={{ fontWeight: strong ? 800 : 500, whiteSpace: 'nowrap' }}>
        {value}
      </Typography>
    </Stack>
  );
}

/**
 * The detail of the customer's delivery: who brings it, what they ordered and
 * what it all costs. Without a linked order there is only the delivery fee.
 */
export default function PublicDeliveryDetail({
  tracking,
  open,
  onClose,
}: {
  tracking: PublicTracking;
  open: boolean;
  onClose: () => void;
}) {
  const order = tracking.order;
  // The order's own delivery charge, when it has one, is the delivery's: it is not added twice.
  const deliveryCharge = order?.includesDeliveryFee ? order.orderDeliveryFee : tracking.fee;
  const total = order ? order.total + (order.includesDeliveryFee ? 0 : tracking.fee) : tracking.fee;
  const payment = order ? (PAYMENT_LABELS[order.paymentStatus] ?? PAYMENT_LABELS.PENDING) : null;

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { maxHeight: '88dvh', borderTopLeftRadius: 16, borderTopRightRadius: 16 } } }}
    >
      <Box sx={{ maxWidth: 560, width: '100%', mx: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Detalle de tu domicilio
          </Typography>
          <IconButton onClick={onClose}>
            <X size={18} />
          </IconButton>
        </Stack>

        <Stack spacing={2} sx={{ p: 2, overflowY: 'auto' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Domiciliario
            </Typography>
            <Typography sx={{ fontWeight: 700 }}>{tracking.courier?.name ?? 'Aún sin asignar'}</Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Entrega en
            </Typography>
            <Typography>{tracking.destination.address}</Typography>
          </Box>

          {order ? (
            <>
              <Divider />
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 800 }}>Pedido #{order.orderNumber}</Typography>
                {payment && <StatusChip label={payment.label} tone={payment.tone} />}
              </Stack>
              <Stack spacing={1.25}>
                {order.items.map((item, index) => (
                  <Box key={`${item.name}-${index}`}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatNumber(item.quantity)} × {item.name}
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                        {formatCOP(item.total)}
                      </Typography>
                    </Stack>
                    {item.options.map((option) => (
                      <Typography key={option} variant="caption" color="text.secondary" component="p">
                        {option}
                      </Typography>
                    ))}
                    {item.notes && (
                      <Typography variant="caption" color="text.secondary" component="p" sx={{ fontStyle: 'italic' }}>
                        {item.notes}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
              <Divider />
              <Stack spacing={0.5}>
                <Line label="Subtotal del pedido" value={formatCOP(order.subtotal)} muted />
                {order.discount > 0 && <Line label="Descuento" value={`− ${formatCOP(order.discount)}`} muted />}
                {order.tax > 0 && <Line label="Impuestos" value={formatCOP(order.tax)} muted />}
                <Line label="Domicilio" value={formatCOP(deliveryCharge)} muted />
                <Line label="Total" value={formatCOP(total)} strong />
              </Stack>
            </>
          ) : (
            <>
              <Divider />
              <Line label="Valor del domicilio" value={formatCOP(tracking.fee)} strong />
              <Typography variant="caption" color="text.secondary">
                El detalle de tu pedido te lo entrega el restaurante.
              </Typography>
            </>
          )}

          <Button onClick={onClose} variant="outlined">
            Cerrar
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
