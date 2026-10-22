import { useEffect, useState } from 'react';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { BellRing, CheckCircle2, MessageCircle, Navigation, Phone, RefreshCw, X } from 'lucide-react';
import { useSnackbar } from 'notistack';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { normalizeApiError } from '../../../lib/api/api-error';
import { computeRoute, type Route } from '../../../lib/google-maps/routes';
import { formatDistance, formatDuration } from '../../../modules/deliveries/delivery-pricing';
import { useAdvanceOwnDelivery, useCallRestaurantAsCourier } from '../../../modules/deliveries/hooks/use-deliveries';
import type { Delivery, LatLng } from '../../../modules/deliveries/types/delivery.types';
import { useChatMessages, useUnreadCount } from '../chat-state';
import CallRestaurantDialog from '../components/CallRestaurantDialog';
import DeliveryChat from '../components/DeliveryChat';
import DeliveryMap from '../components/DeliveryMap';
import { whatsappUrl } from '../share-tracking';

const navigateUrl = (d: Delivery) =>
  `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${d.destination.latitude},${d.destination.longitude}`;
const wazeUrl = (d: Delivery) => `https://waze.com/ul?ll=${d.destination.latitude},${d.destination.longitude}&navigate=yes`;

const COURIER_QUICK_REPLIES = [
  'Voy en camino',
  'Llego en 5 minutos',
  'Ya llegué, estoy afuera',
  'No encuentro la dirección, ¿me ayudas?',
  'Te estoy llamando',
];

const COURIER_CALL_REASONS = [
  'No encuentro la dirección',
  'El cliente no contesta',
  'Problema con el pedido',
  'Problema con el pago',
  'Problema con la moto',
];

interface CourierRouteScreenProps {
  deliveries: Delivery[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  myPosition: LatLng | null;
  onShowPending: () => void;
  /** The delivery whose chat is open, if any (the app also uses it to decide how loudly to notify). */
  chatDeliveryId: string | null;
  onChatChange: (deliveryId: string | null) => void;
}

export default function CourierRouteScreen({
  deliveries,
  selectedId,
  onSelect,
  myPosition,
  onShowPending,
  chatDeliveryId,
  onChatChange,
}: CourierRouteScreenProps) {
  const { enqueueSnackbar } = useSnackbar();
  const advance = useAdvanceOwnDelivery();
  const delivery = deliveries.find((d) => d.id === selectedId) ?? deliveries[0] ?? null;
  const chatOpen = delivery !== null && chatDeliveryId === delivery.id;
  const setChatOpen = (open: boolean) => onChatChange(open && delivery ? delivery.id : null);
  const [confirming, setConfirming] = useState(false);
  const [calling, setCalling] = useState(false);
  const callRestaurant = useCallRestaurantAsCourier();
  const [route, setRoute] = useState<{ deliveryId: string; route: Route } | null>(null);
  const [routeRequest, setRouteRequest] = useState(0);

  // Unread messages, for the badge on the chat button.
  const chatChannel = { as: 'COURIER' as const, deliveryId: delivery?.id ?? '' };
  const { data: messages = [] } = useChatMessages(chatChannel, Boolean(delivery));
  const unread = useUnreadCount(chatChannel, messages);

  // The route from where the courier is (or the branch, until the phone knows) to the customer.
  // Computed once per delivery and on demand, not on every position: it is a paid request.
  const hasPosition = myPosition !== null;
  useEffect(() => {
    if (!delivery) return;
    const start = myPosition ?? delivery.origin;
    const abort = new AbortController();
    computeRoute(start, delivery.destination, abort.signal)
      .then((computed) => setRoute({ deliveryId: delivery.id, route: computed }))
      .catch(() => {});
    return () => abort.abort();
    // myPosition is read when asked, not followed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery?.id, hasPosition, routeRequest]);

  if (!delivery) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', maxWidth: 480, mx: 'auto' }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mt: 4 }}>
          No tienes un domicilio en camino
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Inicia la ruta de uno de tus pendientes.
        </Typography>
        <Button variant="contained" onClick={onShowPending}>
          Ver pendientes
        </Button>
      </Box>
    );
  }

  const currentRoute = route?.deliveryId === delivery.id ? route.route : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {deliveries.length > 1 && (
        <Stack direction="row" spacing={1} sx={{ px: 1.5, py: 1, overflowX: 'auto' }}>
          {deliveries.map((d, index) => (
            <Chip
              key={d.id}
              label={`${index + 1}. ${d.customerName ?? d.destination.address.split(',')[0]}`}
              color={d.id === delivery.id ? 'primary' : 'default'}
              onClick={() => onSelect(d.id)}
            />
          ))}
        </Stack>
      )}

      <Box sx={{ position: 'relative' }}>
        <DeliveryMap
          origin={delivery.origin}
          destination={delivery.destination}
          path={currentRoute?.path}
          markers={myPosition ? [{ id: 'me', position: myPosition, label: 'Yo', title: 'Tu ubicación' }] : []}
          height="42dvh"
        />
        <IconButton
          onClick={() => setRouteRequest((n) => n + 1)}
          sx={{ position: 'absolute', left: 8, bottom: 8, bgcolor: 'background.paper', boxShadow: 2 }}
          title="Recalcular la ruta desde donde estás"
        >
          <RefreshCw size={18} />
        </IconButton>
      </Box>

      <Stack spacing={1.5} sx={{ p: 2, maxWidth: 640, width: '100%', mx: 'auto' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
            {delivery.destination.address}
          </Typography>
          {delivery.destination.details && (
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {delivery.destination.details}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {[
              currentRoute && `${formatDistance(currentRoute.distanceMeters)} · ${formatDuration(currentRoute.durationSeconds)}`,
              `Sale de ${delivery.branchName}`,
              delivery.orderNumber && `Pedido #${delivery.orderNumber}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        </Box>

        {(delivery.customerName || delivery.customerPhone) && (
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontWeight: 700 }}>{delivery.customerName ?? 'Cliente'}</Typography>
              {delivery.customerPhone && (
                <Typography variant="body2" color="text.secondary">
                  {delivery.customerPhone}
                </Typography>
              )}
            </Box>
            {delivery.customerPhone && (
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" startIcon={<Phone size={16} />} href={`tel:${delivery.customerPhone}`}>
                  Llamar
                </Button>
                <Button
                  variant="outlined"
                  href={whatsappUrl(delivery.customerPhone)}
                  target="_blank"
                  rel="noopener"
                >
                  WhatsApp
                </Button>
              </Stack>
            )}
          </Stack>
        )}

        {delivery.notes && (
          <Typography variant="body2" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}>
            {delivery.notes}
          </Typography>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          <Button variant="outlined" startIcon={<Navigation size={18} />} href={navigateUrl(delivery)} target="_blank" rel="noopener">
            Google Maps
          </Button>
          <Button variant="outlined" href={wazeUrl(delivery)} target="_blank" rel="noopener">
            Waze
          </Button>
          <Badge
            badgeContent={unread}
            color="primary"
            sx={{ gridColumn: 'span 2', '& .MuiBadge-badge': { right: 10 } }}
          >
            <Button variant="outlined" startIcon={<MessageCircle size={18} />} onClick={() => setChatOpen(true)} fullWidth>
              Chat
            </Button>
          </Badge>
        </Box>

        <Button variant="outlined" color="warning" startIcon={<BellRing size={18} />} onClick={() => setCalling(true)}>
          Llamar al restaurante
        </Button>

        <Button
          variant="contained"
          color="success"
          size="large"
          startIcon={<CheckCircle2 size={20} />}
          onClick={() => setConfirming(true)}
          sx={{ py: 1.5, fontWeight: 800 }}
        >
          Marcar como entregado
        </Button>
      </Stack>

      <Drawer
        anchor="bottom"
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        slotProps={{ paper: { sx: { height: '80dvh', borderTopLeftRadius: 16, borderTopRightRadius: 16 } } }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}>
          <Typography sx={{ fontWeight: 800 }}>Chat con {delivery.customerName ?? 'el cliente'}</Typography>
          <IconButton onClick={() => setChatOpen(false)}>
            <X size={18} />
          </IconButton>
        </Stack>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <DeliveryChat
            channel={{ as: 'COURIER', deliveryId: delivery.id }}
            canWrite
            quickReplies={COURIER_QUICK_REPLIES}
            height="100%"
          />
        </Box>
      </Drawer>

      <CallRestaurantDialog
        open={calling}
        reasons={COURIER_CALL_REASONS}
        loading={callRestaurant.isPending}
        onClose={() => setCalling(false)}
        onCall={(reason) =>
          callRestaurant.mutate(
            { deliveryId: delivery.id, reason },
            {
              onSuccess: () => {
                setCalling(false);
                enqueueSnackbar('Avisamos al restaurante: está sonando en su pantalla', { variant: 'success' });
              },
              onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
            },
          )
        }
      />

      <ConfirmDialog
        open={confirming}
        title="¿Entregaste el domicilio?"
        description={`A ${delivery.customerName ?? delivery.destination.address}.`}
        confirmLabel="Sí, entregado"
        cancelLabel="Todavía no"
        loading={advance.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          advance.mutate(
            { id: delivery.id, status: 'DELIVERED' },
            {
              onSuccess: () => {
                setConfirming(false);
                enqueueSnackbar('¡Domicilio entregado!', { variant: 'success' });
              },
              onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
            },
          )
        }
      />
    </Box>
  );
}
