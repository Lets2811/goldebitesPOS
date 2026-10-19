import { useEffect, useMemo, useRef, useState } from 'react';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ArrowLeft, ClipboardList, History, LogOut, Navigation, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useLogout } from '../../../modules/auth/hooks/use-logout';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useCurrentBusiness } from '../../../modules/businesses/hooks/use-current-business';
import { useMyDeliveries } from '../../../modules/deliveries/hooks/use-deliveries';
import type { Delivery } from '../../../modules/deliveries/types/delivery.types';
import { playDeliveryUpdateSound } from '../../../modules/orders/utils/notification-sound';
import { useChatNotifications } from '../chat-state';
import { notify } from '../notify';
import IncomingCallDialog from './IncomingCallDialog';
import { useCourierPush, type PushState } from './use-courier-push';
import { useCourierLocation, type LocationStatus } from '../use-courier-location';
import CourierBalanceScreen from './CourierBalanceScreen';
import CourierHistoryScreen from './CourierHistoryScreen';
import CourierPendingScreen from './CourierPendingScreen';
import CourierRouteScreen from './CourierRouteScreen';

type Screen = 'home' | 'route' | 'pending' | 'history' | 'balance';

const TITLES: Record<Exclude<Screen, 'home'>, string> = {
  route: 'Mi ruta actual',
  pending: 'Pendientes',
  history: 'Mis domicilios',
  balance: 'Balance',
};

/** Watches one delivery's chat and notifies when the customer or the restaurant writes. */
function ChatWatcher({ delivery, chatVisible }: { delivery: Delivery; chatVisible: boolean }) {
  useChatNotifications({
    channel: { as: 'COURIER', deliveryId: delivery.id },
    enabled: true,
    chatVisible,
    title: `Mensaje · ${delivery.customerName ?? delivery.destination.address}`,
  });
  return null;
}

/** What to tell the courier so their phone rings with the app closed; null when nothing is needed. */
const PUSH_HINTS: Partial<Record<PushState, { severity: 'info' | 'warning'; text: string; action?: boolean }>> = {
  off: {
    severity: 'info',
    text: 'Activa las notificaciones para que tu teléfono suene con domicilios y llamadas, aunque esté bloqueado.',
    action: true,
  },
  'needs-install': {
    severity: 'warning',
    text: 'En iPhone, para que tu teléfono suene aunque esté bloqueado: toca Compartir → «Agregar a inicio», abre la app desde ese ícono, entra y activa las notificaciones.',
  },
  denied: {
    severity: 'warning',
    text: 'Las notificaciones están bloqueadas: actívalas en los ajustes del navegador para este sitio, o no te llegarán los avisos con el teléfono bloqueado.',
  },
  unsupported: {
    severity: 'warning',
    text: 'Este navegador no recibe notificaciones: usa Chrome (Android) o instala la app (iPhone). Mientras tanto, mantén la app abierta.',
  },
};

const LOCATION_LABELS: Record<LocationStatus, { text: string; color: string } | null> = {
  off: null,
  waiting: { text: 'Buscando tu ubicación…', color: 'warning.main' },
  on: { text: 'Compartiendo ubicación', color: 'success.main' },
  denied: { text: 'Sin permiso de ubicación: actívalo en el navegador', color: 'error.main' },
  unavailable: { text: 'No se pudo obtener tu ubicación', color: 'error.main' },
};

function HomeOption({
  icon,
  label,
  hint,
  count,
  highlight,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  count?: number;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <Badge
      badgeContent={count}
      color="primary"
      sx={{ width: '100%', '& .MuiBadge-badge': { fontSize: 14, height: 26, minWidth: 26, right: 14, top: 14 } }}
    >
      <ButtonBase
        onClick={onClick}
        sx={{
          width: '100%',
          minHeight: 132,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          borderRadius: 3,
          border: '2px solid',
          borderColor: highlight ? 'primary.main' : 'divider',
          textAlign: 'left',
          '&:active': { bgcolor: 'action.selected' },
        }}
      >
        <Box sx={{ color: highlight ? 'primary.main' : 'text.primary' }}>{icon}</Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        </Box>
      </ButtonBase>
    </Badge>
  );
}

/**
 * The courier's app, made for a phone held in one hand: the delivery on the
 * way (with the route and the customer), the ones assigned and waiting, the
 * ones done, and what they add up to. While there is something to deliver it
 * shares the phone's position with the business and the customer.
 */
export default function CourierAppPage() {
  const navigate = useNavigate();
  const logout = useLogout();
  const business = useCurrentBusiness();
  const firstName = useAuthStore((s) => s.user?.firstName);
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatDeliveryId, setChatDeliveryId] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const push = useCourierPush();
  const [enablingPush, setEnablingPush] = useState(false);

  const { data: active = [] } = useMyDeliveries('active');
  const { data: pending = [], isSuccess: pendingLoaded } = useMyDeliveries('pending');
  const tracking = useCourierLocation(active.length > 0 || pending.length > 0);

  // A delivery newly assigned to this courier: sound, vibrate, notify. Not the ones there on opening.
  const knownPending = useRef<Set<string> | null>(null);
  const pendingKey = pending.map((d) => d.id).join(',');
  useEffect(() => {
    if (!pendingLoaded) return;
    const ids = pending.map((d) => d.id);
    if (knownPending.current === null) {
      knownPending.current = new Set(ids);
      return;
    }
    const fresh = pending.filter((d) => !knownPending.current!.has(d.id));
    ids.forEach((id) => knownPending.current!.add(id));
    if (fresh.length === 0) return;
    playDeliveryUpdateSound();
    const first = fresh[0];
    const text = `${first.destination.address}${first.customerName ? ` · ${first.customerName}` : ''}`;
    enqueueSnackbar(`Nuevo domicilio asignado: ${text}`, { variant: 'success', autoHideDuration: 8_000 });
    notify('Nuevo domicilio asignado', text, `assigned-${first.id}`, [300, 100, 300, 100, 300]);
    // pendingKey stands for the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey, pendingLoaded]);
  const location = LOCATION_LABELS[tracking.status];

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  }, []);

  const openRoute = (deliveryId: string | null) => {
    setSelectedId(deliveryId);
    setScreen('route');
  };

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          bgcolor: 'background.default',
        }}
      >
        {screen === 'home' ? (
          <Typography variant="subtitle1" sx={{ fontWeight: 800, pl: 0.5 }} noWrap>
            {[business.data?.name, 'Domicilios'].filter(Boolean).join(' · ')}
          </Typography>
        ) : (
          <Button startIcon={<ArrowLeft size={18} />} onClick={() => setScreen('home')} sx={{ fontWeight: 700 }}>
            {TITLES[screen]}
          </Button>
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
      {[...active, ...pending].map((delivery) => (
        <ChatWatcher
          key={delivery.id}
          delivery={delivery}
          chatVisible={screen === 'route' && chatDeliveryId === delivery.id}
        />
      ))}
      <IncomingCallDialog
        onOpenChat={(deliveryId) => {
          if (active.some((d) => d.id === deliveryId)) {
            setSelectedId(deliveryId);
            setChatDeliveryId(deliveryId);
            setScreen('route');
          } else {
            setScreen('pending');
          }
        }}
      />
      {PUSH_HINTS[push.state] && (
        <Alert
          severity={PUSH_HINTS[push.state]!.severity}
          sx={{ borderRadius: 0 }}
          action={
            PUSH_HINTS[push.state]!.action ? (
              <Button
                color="inherit"
                size="small"
                loading={enablingPush}
                onClick={() => {
                  setEnablingPush(true);
                  push
                    .enable()
                    .catch(() => enqueueSnackbar('No se pudieron activar las notificaciones', { variant: 'error' }))
                    .finally(() => setEnablingPush(false));
                }}
              >
                Activar
              </Button>
            ) : undefined
          }
        >
          {PUSH_HINTS[push.state]!.text}
        </Alert>
      )}
      {location && (
        <Typography
          variant="caption"
          sx={{ px: 2, py: 0.5, color: location.color, borderBottom: 1, borderColor: 'divider' }}
        >
          ● {location.text}
        </Typography>
      )}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {screen === 'home' && (
          <Box sx={{ p: 2, maxWidth: 560, width: '100%', mx: 'auto' }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 1 }}>
              {greeting}
              {firstName ? `, ${firstName}` : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {active.length > 0
                ? `Tienes ${active.length === 1 ? 'un domicilio' : `${active.length} domicilios`} en camino.`
                : pending.length > 0
                  ? `Tienes ${pending.length === 1 ? 'un domicilio asignado' : `${pending.length} domicilios asignados`} por salir.`
                  : 'No tienes domicilios asignados por ahora.'}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <HomeOption
                icon={<Navigation size={32} />}
                label="Mi ruta actual"
                hint={active.length > 0 ? 'Mapa, cliente y chat' : 'Nada en camino'}
                count={active.length}
                highlight={active.length > 0}
                onClick={() => openRoute(null)}
              />
              <HomeOption
                icon={<ClipboardList size={32} />}
                label="Pendientes"
                hint="Asignados, por salir"
                count={pending.length}
                highlight={active.length === 0 && pending.length > 0}
                onClick={() => setScreen('pending')}
              />
              <HomeOption
                icon={<History size={32} />}
                label="Mis domicilios"
                hint="Entregados y cancelados"
                onClick={() => setScreen('history')}
              />
              <HomeOption
                icon={<Wallet size={32} />}
                label="Balance"
                hint="Hoy y esta semana"
                onClick={() => setScreen('balance')}
              />
            </Box>
          </Box>
        )}
        {screen === 'route' && (
          <CourierRouteScreen
            deliveries={active}
            selectedId={selectedId}
            onSelect={setSelectedId}
            myPosition={tracking.position}
            onShowPending={() => setScreen('pending')}
            chatDeliveryId={chatDeliveryId}
            onChatChange={setChatDeliveryId}
          />
        )}
        {screen === 'pending' && (
          <CourierPendingScreen deliveries={pending} onStarted={openRoute} />
        )}
        {screen === 'history' && <CourierHistoryScreen />}
        {screen === 'balance' && <CourierBalanceScreen />}
      </Box>
    </Box>
  );
}
