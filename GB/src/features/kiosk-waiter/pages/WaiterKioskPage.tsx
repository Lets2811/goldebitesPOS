import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Badge from '@mui/material/Badge';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { ArrowLeft, BookOpen, ClipboardList, LogOut, MapPin, Plus, Share2, X } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useLogout } from '../../../modules/auth/hooks/use-logout';
import { useCurrentBusiness } from '../../../modules/businesses/hooks/use-current-business';
import { useBranch } from '../../../modules/branches/hooks/use-branch';
import { useCreateOrder } from '../../../modules/orders/hooks/use-create-order';
import { useUpdateOrderStatus } from '../../../modules/orders/hooks/use-update-order-status';
import { useCartLines } from '../../../modules/orders/hooks/use-cart-lines';
import { useOccupiedTables } from '../../../modules/orders/hooks/use-occupied-tables';
import { getOrderIdentifierLabel } from '../../../modules/orders/order-status';
import { useTableNameMap } from '../../../modules/table-names/hooks/use-table-name-map';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useNotificationsStore } from '../../../store/notificationsStore';
import type { Order, OrderStatus, OrderType } from '../../../modules/orders/types/order.types';
import { useWaiterOrders } from '../hooks/use-waiter-orders';
import CategoryTabs from '../components/CategoryTabs';
import ProductGrid from '../components/ProductGrid';
import CartPanel from '../components/CartPanel';
import WaiterOrderList from '../components/WaiterOrderList';
import WaiterOrderDetailDrawer from '../components/WaiterOrderDetailDrawer';
import ActiveTablesGrid from '../components/ActiveTablesGrid';
import TableHelpAlerts from '../../orders/components/TableHelpAlerts';
import PublicMenuBrowser from '../../public-menu/components/PublicMenuBrowser';
import PublicMenuLinkDialog from '../../products/components/PublicMenuLinkDialog';

/** 'showMenu' es la carta tal como la ve el cliente, para mostrársela en la tablet; 'menu' es el inicio del mesero. */
type Screen = 'menu' | 'order' | 'tables' | 'showMenu';

export default function WaiterKioskPage() {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const business = useCurrentBusiness();
  const branchId = useAuthStore((s) => s.user?.branchId);
  const { data: branch } = useBranch(branchId);
  const occupiedTables = useOccupiedTables(branchId);
  const tableNames = useTableNameMap(branchId);
  const logout = useLogout();
  const addNotification = useNotificationsStore((s) => s.addNotification);

  const [screen, setScreen] = useState<Screen>('menu');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const { cart, addToCart, toggleSauce, toggleSide, increment, decrement, remove, clear } = useCartLines();
  const [tableNumber, setTableNumber] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [myOrdersOpen, setMyOrdersOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  useEffect(() => {
    const requestFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));

    requestFullscreen();
    // Browsers block requestFullscreen without a direct user gesture, so this tab
    // (opened via "Abrir en modo tablet") retries on the first tap/click on the page.
    document.addEventListener('click', requestFullscreen, { once: true });
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('click', requestFullscreen);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  function handleExitFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  const createOrder = useCreateOrder();
  const updateStatus = useUpdateOrderStatus();
  const { orders } = useWaiterOrders();

  const previousStatuses = useRef<Map<string, OrderStatus>>(new Map());

  useEffect(() => {
    for (const order of orders) {
      const prev = previousStatuses.current.get(order.id);
      if (prev && prev !== 'READY' && order.status === 'READY') {
        enqueueSnackbar(`¡Pedido #${order.orderNumber} listo! ${getOrderIdentifierLabel(order, tableNames)}`, {
          variant: 'success',
          persist: true,
          // Ancla arriba (no abajo, el default) para no tapar el botón "Marcar
          // como entregado" del panel de detalle, que también vive abajo — este
          // aviso queda fijo hasta que el mesero lo cierra, así que si se
          // superpusiera con ese botón, bloquearía justo la acción que sigue.
          anchorOrigin: { vertical: 'top', horizontal: 'right' },
          action: (key) => (
            <Button color="inherit" size="small" onClick={() => closeSnackbar(key)}>
              OK
            </Button>
          ),
        });
        addNotification({
          title: 'Pedido listo',
          message: `#${order.orderNumber} — ${getOrderIdentifierLabel(order, tableNames)}`,
          level: 'success',
        });
      }
    }
    previousStatuses.current = new Map(orders.map((order) => [order.id, order.status]));
  }, [orders, tableNames, enqueueSnackbar, closeSnackbar, addNotification]);

  function startNewOrder() {
    clear();
    setTableNumber('');
    setOrderType('DINE_IN');
    setCustomerName('');
    setOrderNotes('');
    setScreen('order');
  }

  function handleSubmit() {
    if (!branchId) {
      enqueueSnackbar('Tu usuario no tiene una sucursal asignada; no puedes crear pedidos.', {
        variant: 'error',
      });
      return;
    }
    if (orderType === 'DINE_IN' && tableNumber && occupiedTables.has(tableNumber)) {
      enqueueSnackbar('Esa mesa ya tiene un pedido activo. Usa "Agregar productos" desde ese pedido.', {
        variant: 'error',
      });
      return;
    }

    createOrder.mutate(
      {
        branchId,
        orderType,
        tableNumber: orderType === 'DINE_IN' ? tableNumber || undefined : undefined,
        customerName: customerName || undefined,
        notes: orderNotes || undefined,
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
          clear();
          setTableNumber('');
          setCustomerName('');
          setOrderNotes('');
          setScreen('menu');
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
          px: 2,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
          {[business.data?.name, 'Mesero'].filter(Boolean).join(' · ')}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Badge badgeContent={orders.length} color="primary">
            <Button
              size="small"
              variant="outlined"
              startIcon={<ClipboardList size={16} />}
              onClick={() => setMyOrdersOpen(true)}
            >
              Mis pedidos
            </Button>
          </Badge>
          {isFullscreen && (
            <Tooltip title="Salir de pantalla completa">
              <IconButton size="small" color="inherit" onClick={handleExitFullscreen}>
                <X size={18} />
              </IconButton>
            </Tooltip>
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

      {/* Las mesas que piden ayuda se ven y suenan en cualquier pantalla del mesero. */}
      <TableHelpAlerts branchId={branchId} tableNames={tableNames} sx={{ px: 2, pt: 1.5 }} />

      {screen === 'menu' && (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            alignContent: 'center',
            justifyContent: 'center',
            gap: 3,
            p: 3,
            overflowY: 'auto',
          }}
        >
          <ButtonBase
            onClick={startNewOrder}
            sx={{
              width: 280,
              height: 200,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              borderRadius: 3,
              border: '2px solid',
              borderColor: 'primary.main',
              '&:active': { bgcolor: 'action.selected' },
            }}
          >
            <Plus size={40} />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Pedido nuevo
            </Typography>
          </ButtonBase>

          <Badge badgeContent={occupiedTables.size} color="secondary" sx={{ '& .MuiBadge-badge': { fontSize: 14, height: 24, minWidth: 24 } }}>
            <ButtonBase
              onClick={() => setScreen('tables')}
              sx={{
                width: 280,
                height: 200,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                borderRadius: 3,
                border: '2px solid',
                borderColor: 'divider',
                '&:active': { bgcolor: 'action.selected' },
              }}
            >
              <MapPin size={40} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Mesas activas
              </Typography>
            </ButtonBase>
          </Badge>

          <ButtonBase
            onClick={() => setScreen('showMenu')}
            sx={{
              width: 280,
              height: 200,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              borderRadius: 3,
              border: '2px solid',
              borderColor: 'divider',
              '&:active': { bgcolor: 'action.selected' },
            }}
          >
            <BookOpen size={40} />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Mostrar menú
            </Typography>
          </ButtonBase>
        </Box>
      )}

      {screen === 'showMenu' && (
        <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" sx={{ p: 1.5, justifyContent: 'space-between' }}>
            <Button startIcon={<ArrowLeft size={16} />} onClick={() => setScreen('menu')}>
              Volver
            </Button>
            <Button variant="outlined" startIcon={<Share2 size={16} />} onClick={() => setShareMenuOpen(true)}>
              Enviar menú
            </Button>
          </Stack>
          {/* Solo de consulta: el pedido lo sigue tomando el mesero desde "Pedido nuevo". */}
          <Box sx={{ px: 2 }}>
            <PublicMenuBrowser businessId={business.data?.id} readOnly />
          </Box>
        </Box>
      )}

      {screen === 'tables' && (
        <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 1.5 }}>
            <Button startIcon={<ArrowLeft size={16} />} onClick={() => setScreen('menu')}>
              Volver
            </Button>
          </Box>
          <ActiveTablesGrid branchId={branchId} onSelect={setSelectedOrderId} />
        </Box>
      )}

      {screen === 'order' && (
        <Stack direction="row" sx={{ flex: 1, overflow: 'hidden' }}>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 1.5, py: 1 }}>
              <Button startIcon={<ArrowLeft size={16} />} onClick={() => setScreen('menu')}>
                Volver
              </Button>
            </Box>
            <CategoryTabs value={categoryId} onChange={setCategoryId} />
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              <ProductGrid categoryId={categoryId} onSelect={addToCart} />
            </Box>
          </Box>

          <Box
            sx={{
              width: 380,
              flexShrink: 0,
              borderLeft: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <CartPanel
              cart={cart}
              onIncrement={increment}
              onDecrement={decrement}
              onRemove={remove}
              onToggleSauce={toggleSauce}
              onToggleSide={toggleSide}
              tableNumber={tableNumber}
              onTableNumberChange={setTableNumber}
              tableCount={branch?.tableCount}
              occupiedTables={occupiedTables}
              orderType={orderType}
              onOrderTypeChange={setOrderType}
              customerName={customerName}
              onCustomerNameChange={setCustomerName}
              orderNotes={orderNotes}
              onOrderNotesChange={setOrderNotes}
              onSubmit={handleSubmit}
              submitting={createOrder.isPending}
            />
          </Box>
        </Stack>
      )}

      <Drawer anchor="right" open={myOrdersOpen} onClose={() => setMyOrdersOpen(false)}>
        <Box sx={{ width: 360, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Mis pedidos ({orders.length})
            </Typography>
            <IconButton onClick={() => setMyOrdersOpen(false)} aria-label="Cerrar">
              <X size={18} />
            </IconButton>
          </Stack>
          <Divider />
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            <WaiterOrderList
              orders={orders}
              tableNames={tableNames}
              onSelect={(order: Order) => {
                setMyOrdersOpen(false);
                setSelectedOrderId(order.id);
              }}
            />
          </Box>
        </Box>
      </Drawer>

      <PublicMenuLinkDialog
        open={shareMenuOpen}
        businessId={business.data?.id}
        businessName={business.data?.name}
        onClose={() => setShareMenuOpen(false)}
      />

      <WaiterOrderDetailDrawer
        orderId={selectedOrderId}
        tableNames={tableNames}
        onClose={() => setSelectedOrderId(null)}
      />
    </Box>
  );
}
