import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import { ChefHat, PackageCheck } from 'lucide-react';
import StatusChip from '../../../components/common/StatusChip';
import OptionSelectionsText from '../../../modules/option-groups/components/OptionSelectionsText';
import OrderTimer from '../../orders/components/OrderTimer';
import { useOrder } from '../../../modules/orders/hooks/use-order';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  ORDER_TYPE_LABELS,
  getOrderIdentifierLabel,
  isOrderDelayed,
} from '../../../modules/orders/order-status';
import type { Order } from '../../../modules/orders/types/order.types';
import { statusColors } from '../../../theme/palette';

interface KitchenOrderCardProps {
  order: Order;
  onStartPreparation: (order: Order) => void;
  onMarkReady: (order: Order) => void;
  tableNames?: Record<string, string>;
}

export default function KitchenOrderCard({
  order,
  onStartPreparation,
  onMarkReady,
  tableNames,
}: KitchenOrderCardProps) {
  const delayed = isOrderDelayed(order.status, order.createdAt);
  const { data: fullOrder } = useOrder(order.id);
  const items = fullOrder?.items ?? [];

  return (
    <Card
      sx={{
        borderColor: delayed ? alpha(statusColors.error, 0.55) : undefined,
        borderWidth: delayed ? 2 : 1,
      }}
    >
      <CardContent>
        <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              #{order.orderNumber}
            </Typography>
            <StatusChip label={ORDER_TYPE_LABELS[order.orderType]} tone="neutral" />
          </Box>
          <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
            <OrderTimer createdAt={order.createdAt} />
            <StatusChip label={ORDER_STATUS_LABELS[order.status]} tone={ORDER_STATUS_TONE[order.status]} />
          </Stack>
        </Stack>

        {order.tableNumber && (
          <Typography variant="caption" color="text.secondary">
            {getOrderIdentifierLabel(order, tableNames)}
          </Typography>
        )}

        {delayed && (
          <Typography variant="caption" color="error.main" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
            ⚠ Pedido fuera del tiempo estándar de preparación
          </Typography>
        )}

        <Divider sx={{ my: 1.5 }} />

        <Stack spacing={1.25}>
          {items.map((item) => (
            <Box key={item.id}>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {item.quantity}× {item.productNameSnapshot}
              </Typography>
              {item.optionSelections.length > 0 && (
                <Typography variant="caption" sx={{ display: 'block' }}>
                  <OptionSelectionsText item={item} />
                </Typography>
              )}
              {item.notes && (
                <Typography variant="caption" color="warning.main" sx={{ display: 'block', fontWeight: 600 }}>
                  Nota: {item.notes}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>

        {order.notes && (
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 1.5, p: 1, borderRadius: 1, backgroundColor: alpha(statusColors.warning, 0.12) }}
          >
            📝 {order.notes}
          </Typography>
        )}

        <Divider sx={{ my: 1.5 }} />

        {order.status === 'CONFIRMED' && (
          <Button
            fullWidth
            variant="contained"
            startIcon={<ChefHat size={16} />}
            onClick={() => onStartPreparation(order)}
          >
            Iniciar preparación
          </Button>
        )}

        {order.status === 'PREPARING' && (
          <Button fullWidth variant="contained" startIcon={<PackageCheck size={16} />} onClick={() => onMarkReady(order)}>
            Marcar como listo
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
