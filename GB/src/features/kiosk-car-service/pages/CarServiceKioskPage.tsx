import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { LogOut, Car } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useRequiredOptionCheck } from '../../../modules/option-groups/hooks/use-required-option-check';
import { cartLineToOrderItem, useCartLines } from '../../../modules/orders/hooks/use-cart-lines';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useLogout } from '../../../modules/auth/hooks/use-logout';
import { useCurrentBusiness } from '../../../modules/businesses/hooks/use-current-business';
import { useCreateOrder } from '../../../modules/orders/hooks/use-create-order';
import { useUpdateOrderStatus } from '../../../modules/orders/hooks/use-update-order-status';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useNotificationsStore } from '../../../store/notificationsStore';
import type { OrderStatus } from '../../../modules/orders/types/order.types';
import { useWaiterOrders } from '../../kiosk-waiter/hooks/use-waiter-orders';
import CarServiceCategoryStrip from '../components/CarServiceCategoryStrip';
import CarServiceProductGrid from '../components/CarServiceProductGrid';
import CarServiceCartPanel from '../components/CarServiceCartPanel';
import MockPaymentGatewayDialog from '../components/MockPaymentGatewayDialog';

interface PayingOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
}

export default function CarServiceKioskPage() {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const checkRequiredOptions = useRequiredOptionCheck();
  const navigate = useNavigate();
  const business = useCurrentBusiness();
  const branchId = useAuthStore((s) => s.user?.branchId);
  const logout = useLogout();
  const addNotification = useNotificationsStore((s) => s.addNotification);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const { cart, addToCart, toggleOption, increment, decrement, remove, clear } = useCartLines();
  const [vehicleTag, setVehicleTag] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [payingOrder, setPayingOrder] = useState<PayingOrder | null>(null);
  const [lastOrderNumber, setLastOrderNumber] = useState<string | null>(null);

  const createOrder = useCreateOrder();
  const updateStatus = useUpdateOrderStatus();
  const { orders } = useWaiterOrders();

  const previousStatuses = useRef<Map<string, OrderStatus>>(new Map());

  useEffect(() => {
    for (const order of orders) {
      const prev = previousStatuses.current.get(order.id);
      if (prev && prev !== 'READY' && order.status === 'READY') {
        enqueueSnackbar(`¡Pedido #${order.orderNumber} listo! Vehículo ${order.tableNumber ?? '—'}`, {
          variant: 'success',
          persist: true,
          anchorOrigin: { vertical: 'top', horizontal: 'right' },
          action: (key) => (
            <Button color="inherit" size="small" onClick={() => closeSnackbar(key)}>
              OK
            </Button>
          ),
        });
        addNotification({
          title: 'Pedido listo',
          message: `#${order.orderNumber} — Vehículo ${order.tableNumber ?? '—'}`,
          level: 'success',
        });
      }
    }
    previousStatuses.current = new Map(orders.map((order) => [order.id, order.status]));
  }, [orders, enqueueSnackbar, closeSnackbar, addNotification]);

  function handleSubmit() {
    if (!branchId) {
      enqueueSnackbar('Tu usuario no tiene una sucursal asignada; no puedes crear pedidos.', {
        variant: 'error',
      });
      return;
    }
    const missingOption = checkRequiredOptions(cart);
    if (missingOption) {
      enqueueSnackbar(missingOption, { variant: 'error' });
      return;
    }

    createOrder.mutate(
      {
        branchId,
        orderType: 'CAR_SERVICE',
        tableNumber: vehicleTag || undefined,
        customerName: customerName || undefined,
        items: cart.map(cartLineToOrderItem),
      },
      {
        onSuccess: (order) => {
          updateStatus.mutate({ id: order.id, status: 'CONFIRMED' });
          enqueueSnackbar(`Pedido #${order.orderNumber} enviado a cocina`, { variant: 'success' });
          clear();
          setVehicleTag('');
          setCustomerName('');
          setLastOrderNumber(order.orderNumber);
          setPayingOrder({ id: order.id, orderNumber: order.orderNumber, totalAmount: order.totalAmount });
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );
  }

  return (
    <Box sx={{ height: '100vh', width: '100vw', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2.5,
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Car size={22} color="#0B0B0C" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', lineHeight: 1.1 }}>
              {business.data?.name ?? ''}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1, textTransform: 'uppercase' }}>
              Car Service
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          {lastOrderNumber !== null && (
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
                px: 2,
                py: 0.75,
                borderRadius: 3,
                border: '2px solid',
                borderColor: 'primary.main',
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                ÚLTIMO PEDIDO
              </Typography>
              <Typography sx={{ fontWeight: 900, fontSize: '1.15rem', color: 'primary.main' }}>
                #{lastOrderNumber}
              </Typography>
            </Stack>
          )}
          <Button
            size="small"
            color="inherit"
            startIcon={<LogOut size={16} />}
            onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })}
          >
            Salir
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" sx={{ flex: 1, overflow: 'hidden' }}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <CarServiceCategoryStrip value={categoryId} onChange={setCategoryId} />
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            <CarServiceProductGrid categoryId={categoryId} onSelect={addToCart} />
          </Box>
        </Box>

        <Box
          sx={{
            width: 420,
            flexShrink: 0,
            borderLeft: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <CarServiceCartPanel
            cart={cart}
            onIncrement={increment}
            onDecrement={decrement}
            onRemove={remove}
            onToggleOption={toggleOption}
            vehicleTag={vehicleTag}
            onVehicleTagChange={setVehicleTag}
            customerName={customerName}
            onCustomerNameChange={setCustomerName}
            onSubmit={handleSubmit}
            submitting={createOrder.isPending}
          />
        </Box>
      </Stack>

      <MockPaymentGatewayDialog
        open={Boolean(payingOrder)}
        order={payingOrder}
        onClose={() => setPayingOrder(null)}
        onPaid={() => enqueueSnackbar('Pago registrado correctamente', { variant: 'success' })}
      />
    </Box>
  );
}
