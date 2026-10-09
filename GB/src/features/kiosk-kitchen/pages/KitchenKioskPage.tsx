import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { LogOut, ChefHat } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useLogout } from '../../../modules/auth/hooks/use-logout';
import { useCurrentBusiness } from '../../../modules/businesses/hooks/use-current-business';
import { useKitchenQueue } from '../../../modules/kitchen/hooks/use-kitchen-queue';
import { normalizeApiError } from '../../../lib/api/api-error';
import { ORDER_STATUS_LABELS } from '../../../modules/orders/order-status';
import { useTableNameMap } from '../../../modules/table-names/hooks/use-table-name-map';
import type { Order } from '../../../modules/orders/types/order.types';
import EmptyState from '../../../components/common/EmptyState';
import SwipeableTicketCard from '../components/SwipeableTicketCard';

export default function KitchenKioskPage() {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const business = useCurrentBusiness();
  const logout = useLogout();
  const containerRef = useRef<HTMLDivElement>(null);
  const branchId = useAuthStore((s) => s.user?.branchId);
  const tableNames = useTableNameMap(branchId);

  const { data: queue } = useKitchenQueue();
  const kitchenOrders = queue ?? [];

  useEffect(() => {
    containerRef.current?.requestFullscreen?.().catch(() => {
      // El navegador puede rechazar el fullscreen automático sin gesto del usuario — no es crítico.
    });
  }, []);

  function handleSuccess(order: Order, status: 'PREPARING' | 'READY') {
    enqueueSnackbar(`Pedido #${order.orderNumber} ahora está "${ORDER_STATUS_LABELS[status]}"`, {
      variant: 'success',
    });
  }

  function handleError(error: unknown) {
    enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' });
  }

  return (
    <Box
      ref={containerRef}
      sx={{ height: '100vh', width: '100vw', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
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
          {[business.data?.name, 'Cocina'].filter(Boolean).join(' · ')}
        </Typography>
        <Button
          size="small"
          color="inherit"
          startIcon={<LogOut size={16} />}
          onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })}
        >
          Salir
        </Button>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {kitchenOrders.length === 0 ? (
          <EmptyState
            icon={ChefHat}
            title="No hay pedidos activos"
            description="Los nuevos pedidos confirmados aparecerán aquí automáticamente."
          />
        ) : (
          <Grid container spacing={2.5}>
            {kitchenOrders.map((order) => (
              <Grid key={order.id} size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}>
                <SwipeableTicketCard
                  order={order}
                  onSuccess={handleSuccess}
                  onError={handleError}
                  tableNames={tableNames}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  );
}
