import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { ChefHat, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatusChip from '../../../components/common/StatusChip';
import EmptyState from '../../../components/common/EmptyState';
import OrderTimer from '../../orders/components/OrderTimer';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  ORDER_TYPE_LABELS,
} from '../../../modules/orders/order-status';
import type { Order } from '../../../modules/orders/types/order.types';

export default function KitchenSnapshot({ orders }: { orders: Order[] }) {
  const navigate = useNavigate();

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Pedidos en cocina
          </Typography>
          <Button
            size="small"
            endIcon={<ArrowRight size={14} />}
            onClick={() => navigate('/cocina')}
          >
            Ver cocina
          </Button>
        </Stack>
        {orders.length === 0 ? (
          <EmptyState
            icon={ChefHat}
            title="Sin pedidos activos"
            description="La cocina está al día."
          />
        ) : (
          <Stack spacing={1.25}>
            {orders.slice(0, 5).map((order) => (
              <Stack
                key={order.id}
                direction="row"
                sx={{
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Stack>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    #{order.orderNumber}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {ORDER_TYPE_LABELS[order.orderType]}
                  </Typography>
                </Stack>
                <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                  <StatusChip
                    label={ORDER_STATUS_LABELS[order.status]}
                    tone={ORDER_STATUS_TONE[order.status]}
                    size="small"
                  />
                  <OrderTimer createdAt={order.createdAt} compact />
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
