import { useEffect, useRef, useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { BellRing, Bike, PhoneCall, Receipt } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import {
  useCallCourierAsCustomer,
  useCallRestaurantAsCustomer,
  usePublicTracking,
} from '../../../modules/deliveries/hooks/use-deliveries';
import { normalizeApiError } from '../../../lib/api/api-error';
import { playDeliveryUpdateSound } from '../../../modules/orders/utils/notification-sound';
import { formatDistance } from '../../../modules/deliveries/delivery-pricing';
import type { PublicTracking } from '../../../modules/deliveries/types/delivery.types';
import { formatTimeCO } from '../../../utils/format';
import { useChatNotifications } from '../chat-state';
import CallRestaurantDialog from '../components/CallRestaurantDialog';
import DeliveryChat from '../components/DeliveryChat';
import { askForNotifications, canAskForNotifications, notify } from '../notify';
import DeliveryMap from '../components/DeliveryMap';
import PublicDeliveryDetail from './PublicDeliveryDetail';
import { straightDistance } from '../geo';
import { TRACKING_PATH } from '../share-tracking';

const CODE_PATTERN = /^[A-Z0-9]{6}$/;

function CodeForm({ initial = '', error }: { initial?: string; error?: string }) {
  const navigate = useNavigate();
  const [code, setCode] = useState(initial);
  const normalized = code.replace(/[^a-z0-9]/gi, '').toUpperCase();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (CODE_PATTERN.test(normalized)) navigate(`${TRACKING_PATH}/${normalized}`);
  }

  return (
    <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Código de tu domicilio"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Ej. K7P2QX"
        autoFocus
        slotProps={{
          htmlInput: {
            maxLength: 8,
            autoCapitalize: 'characters',
            autoComplete: 'off',
            style: { letterSpacing: 6, fontSize: 24, fontWeight: 700, textAlign: 'center' },
          },
        }}
        error={Boolean(error)}
        helperText={error ?? 'Son 6 letras y números. Te lo envía el restaurante o tu domiciliario.'}
      />
      <Button type="submit" variant="contained" size="large" disabled={!CODE_PATTERN.test(normalized)}>
        Ver mi domicilio
      </Button>
    </Box>
  );
}

const STEPS = ['Recibido', 'Domiciliario asignado', 'En camino', 'Entregado'];

const CUSTOMER_QUICK_REPLIES = ['¿Cuánto falta?', 'Ya estoy afuera', 'Por favor llama al llegar', 'Gracias'];

const CUSTOMER_CALL_REASONS = [
  '¿Dónde está mi pedido?',
  'Mi pedido llegó incompleto',
  'Quiero cambiar la dirección',
  'El domiciliario no responde',
];

function activeStep(tracking: PublicTracking): number {
  switch (tracking.status) {
    case 'PENDING':
      return 0;
    case 'ASSIGNED':
      return 1;
    case 'IN_TRANSIT':
      return 2;
    default:
      return 4;
  }
}

function headline(tracking: PublicTracking): string {
  const courier = tracking.courier?.name ?? 'Tu domiciliario';
  switch (tracking.status) {
    case 'PENDING':
      return 'Estamos preparando tu domicilio';
    case 'ASSIGNED':
      return `${courier} recogerá tu pedido pronto`;
    case 'IN_TRANSIT':
      return `${courier} va en camino`;
    case 'DELIVERED':
      return '¡Tu domicilio fue entregado!';
    case 'CANCELLED':
      return 'Este domicilio fue cancelado';
  }
}

function Tracking({ code }: { code: string }) {
  const { enqueueSnackbar } = useSnackbar();
  const { data: tracking, isLoading, isError } = usePublicTracking(code);
  const callRestaurant = useCallRestaurantAsCustomer(code);
  const callCourier = useCallCourierAsCustomer(code);
  const [calling, setCalling] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [askNotifications, setAskNotifications] = useState(canAskForNotifications);

  // Messages from the courier or the restaurant: sound, and a notification when the page is in the background.
  useChatNotifications({
    channel: { as: 'CUSTOMER', code },
    enabled: Boolean(tracking?.courier),
    chatVisible: true,
    title: tracking?.businessName ? `Mensaje · ${tracking.businessName}` : 'Nuevo mensaje',
  });

  // Each change of status (assigned, on the way, delivered) sounds and notifies; not the one on opening.
  const lastStatus = useRef<string | null>(null);
  const status = tracking?.status;
  useEffect(() => {
    if (!tracking || !status) return;
    const previous = lastStatus.current;
    lastStatus.current = status;
    if (previous === null || previous === status) return;
    playDeliveryUpdateSound();
    notify(tracking.businessName, headline(tracking), `status-${code}`);
    // The status is what is followed; the rest is read when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !tracking) {
    return (
      <Card sx={{ p: 2.5 }}>
        <CodeForm initial={code} error="No encontramos un domicilio activo con ese código." />
      </Card>
    );
  }

  const courierAt = tracking.courier?.location ?? null;
  const open = tracking.status !== 'DELIVERED' && tracking.status !== 'CANCELLED';
  const remaining = courierAt ? straightDistance(courierAt, tracking.destination) : null;

  return (
    <>
      <Box>
        <Typography variant="overline" color="text.secondary">
          {tracking.businessName} · {tracking.branchName}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
          {headline(tracking)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {tracking.destination.address}
          {remaining !== null && ` · a ${formatDistance(remaining)} en línea recta`}
        </Typography>
      </Box>

      <Button variant="outlined" startIcon={<Receipt size={18} />} onClick={() => setDetailOpen(true)}>
        Ver detalle{tracking.order ? ` del pedido #${tracking.order.orderNumber}` : ''}
      </Button>
      <PublicDeliveryDetail tracking={tracking} open={detailOpen} onClose={() => setDetailOpen(false)} />

      {tracking.status !== 'CANCELLED' && (
        <Stepper activeStep={activeStep(tracking)} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      )}

      {tracking.status !== 'CANCELLED' && tracking.status !== 'DELIVERED' && (
        <DeliveryMap
          origin={tracking.origin}
          destination={tracking.destination}
          markers={
            courierAt
              ? [{ id: 'courier', position: courierAt, label: '🛵', title: tracking.courier?.name ?? 'Domiciliario' }]
              : []
          }
          fitKey={courierAt ? 'with-courier' : 'without-courier'}
          height="45dvh"
        />
      )}
      {tracking.status === 'IN_TRANSIT' && !courierAt && (
        <Alert severity="info">La ubicación del domiciliario aparecerá en cuanto su teléfono la comparta.</Alert>
      )}
      {tracking.status === 'DELIVERED' && tracking.deliveredAt && (
        <Alert severity="success">Entregado a las {formatTimeCO(tracking.deliveredAt)}. ¡Buen provecho!</Alert>
      )}

      {askNotifications && open && (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" onClick={() => void askForNotifications().finally(() => setAskNotifications(false))}>
              Activar
            </Button>
          }
        >
          Activa las notificaciones para saber cuándo sale y llega tu pedido, aunque cambies de app.
        </Alert>
      )}

      {tracking.courier && (
        <Card sx={{ overflow: 'hidden' }}>
          <Typography sx={{ fontWeight: 800, px: 2, pt: 1.5 }}>Chat con {tracking.courier.name}</Typography>
          <DeliveryChat
            channel={{ as: 'CUSTOMER', code: tracking.code }}
            canWrite={tracking.chatOpen}
            quickReplies={CUSTOMER_QUICK_REPLIES}
            height={340}
          />
        </Card>
      )}

      {open && tracking.courier && (
        <Button
          variant="contained"
          size="large"
          startIcon={<PhoneCall size={18} />}
          loading={callCourier.isPending}
          onClick={() =>
            callCourier.mutate(undefined, {
              onSuccess: (result) =>
                enqueueSnackbar(
                  result.called
                    ? `Llamamos a ${tracking.courier!.name}: su teléfono está sonando`
                    : `Ya llamamos a ${tracking.courier!.name}; en un momento te responde`,
                  { variant: result.called ? 'success' : 'info' },
                ),
              onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
            })
          }
        >
          Llamar a mi domiciliario
        </Button>
      )}

      {open &&
        (tracking.helpPending ? (
          <Alert severity="warning" icon={<BellRing size={20} />}>
            Avisamos a {tracking.businessName}: revisarán tu domicilio y te contactarán pronto.
          </Alert>
        ) : (
          <Button variant="outlined" color="warning" size="large" startIcon={<BellRing size={18} />} onClick={() => setCalling(true)}>
            Llamar al restaurante
          </Button>
        ))}

      <CallRestaurantDialog
        open={calling}
        reasons={CUSTOMER_CALL_REASONS}
        loading={callRestaurant.isPending}
        onClose={() => setCalling(false)}
        onCall={(reason) =>
          callRestaurant.mutate(reason, {
            onSuccess: () => setCalling(false),
            onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
          })
        }
      />
    </>
  );
}

/**
 * The customer's tracking page: public, no login. /seguimiento asks for the
 * code; /seguimiento/:code shows the delivery, the courier on the map and the
 * chat with them, refreshed every few seconds.
 */
export default function PublicTrackingPage() {
  const { code = '' } = useParams();
  const normalized = code.toUpperCase();

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 560, mx: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
          <Bike size={24} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Sigue tu domicilio
          </Typography>
        </Box>
        {normalized ? (
          <Tracking key={normalized} code={normalized} />
        ) : (
          <Card sx={{ p: 2.5 }}>
            <CodeForm />
          </Card>
        )}
      </Box>
    </Box>
  );
}
