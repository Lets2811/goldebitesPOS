import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { LogOut, Car } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useLogout } from '../../../modules/auth/hooks/use-logout';
import { useCurrentBusiness } from '../../../modules/businesses/hooks/use-current-business';
import { useCreateOrder } from '../../../modules/orders/hooks/use-create-order';
import { useUpdateOrderStatus } from '../../../modules/orders/hooks/use-update-order-status';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useNotificationsStore } from '../../../store/notificationsStore';
import { generateId } from '../../../utils/generate-id';
import type { OrderStatus } from '../../../modules/orders/types/order.types';
import type { Product } from '../../../modules/products/types/product.types';
import { useWaiterOrders } from '../../kiosk-waiter/hooks/use-waiter-orders';
import type { CartLine } from '../../kiosk-waiter/components/CartPanel';
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
  const navigate = useNavigate();
  const business = useCurrentBusiness();
  const branchId = useAuthStore((s) => s.user?.branchId);
  const logout = useLogout();
  const addNotification = useNotificationsStore((s) => s.addNotification);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
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

  function handleAddToCart(product: Product) {
    setCart((prev) => {
      // Products with sauces/sides need one picker per unit, so each tap adds its own
      // independently-configurable line instead of bumping a shared quantity.
      const isCustomizable = product.maxSauces > 0 || product.maxSides > 0;
      if (!isCustomizable) {
        const existing = prev.find((line) => line.productId === product.id);
        if (existing) {
          return prev.map((line) =>
            line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line,
          );
        }
      }
      return [
        ...prev,
        {
          id: generateId(),
          productId: product.id,
          name: product.name,
          unitPrice: product.salePrice,
          quantity: 1,
          maxSauces: product.maxSauces,
          maxSides: product.maxSides,
          sauceIds: [],
          sideIds: [],
        },
      ];
    });
  }

  function handleToggleSauce(id: string, sauceId: string) {
    setCart((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const selected = line.sauceIds.includes(sauceId);
        if (!selected && line.sauceIds.length >= line.maxSauces) return line;
        return {
          ...line,
          sauceIds: selected
            ? line.sauceIds.filter((sid) => sid !== sauceId)
            : [...line.sauceIds, sauceId],
        };
      }),
    );
  }

  function handleToggleSide(id: string, sideId: string) {
    setCart((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const selected = line.sideIds.includes(sideId);
        if (!selected && line.sideIds.length >= line.maxSides) return line;
        return {
          ...line,
          sideIds: selected
            ? line.sideIds.filter((sid) => sid !== sideId)
            : [...line.sideIds, sideId],
        };
      }),
    );
  }

  function handleIncrement(id: string) {
    setCart((prev) => {
      const line = prev.find((l) => l.id === id);
      if (!line) return prev;
      const isCustomizable = line.maxSauces > 0 || line.maxSides > 0;
      if (isCustomizable) {
        return [
          ...prev,
          {
            id: generateId(),
            productId: line.productId,
            name: line.name,
            unitPrice: line.unitPrice,
            quantity: 1,
            maxSauces: line.maxSauces,
            maxSides: line.maxSides,
            sauceIds: [],
            sideIds: [],
          },
        ];
      }
      return prev.map((l) => (l.id === id ? { ...l, quantity: l.quantity + 1 } : l));
    });
  }

  function handleDecrement(id: string) {
    setCart((prev) =>
      prev
        .map((line) => (line.id === id ? { ...line, quantity: line.quantity - 1 } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  function handleRemove(id: string) {
    setCart((prev) => prev.filter((line) => line.id !== id));
  }

  function handleSubmit() {
    if (!branchId) {
      enqueueSnackbar('Tu usuario no tiene una sucursal asignada; no puedes crear pedidos.', {
        variant: 'error',
      });
      return;
    }

    createOrder.mutate(
      {
        branchId,
        orderType: 'CAR_SERVICE',
        tableNumber: vehicleTag || undefined,
        customerName: customerName || undefined,
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          sauceIds: line.sauceIds.length ? line.sauceIds : undefined,
          sideIds: line.sideIds.length ? line.sideIds : undefined,
        })),
      },
      {
        onSuccess: (order) => {
          updateStatus.mutate({ id: order.id, status: 'CONFIRMED' });
          enqueueSnackbar(`Pedido #${order.orderNumber} enviado a cocina`, { variant: 'success' });
          setCart([]);
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
            <CarServiceProductGrid categoryId={categoryId} onSelect={handleAddToCart} />
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
            onIncrement={handleIncrement}
            onDecrement={handleDecrement}
            onRemove={handleRemove}
            onToggleSauce={handleToggleSauce}
            onToggleSide={handleToggleSide}
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
