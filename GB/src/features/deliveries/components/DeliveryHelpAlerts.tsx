import { useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { BellRing } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import { useAllBranchesReview } from '../../../modules/auth/hooks/use-branch-mode';
import {
  useAttendDeliveryHelpRequest,
  useDeliveryHelpRequests,
} from '../../../modules/deliveries/hooks/use-deliveries';
import type { DeliveryHelpRequest } from '../../../modules/deliveries/types/delivery.types';
import { playTableHelpAlertSound } from '../../../modules/orders/utils/notification-sound';
import { useNotificationsStore } from '../../../store/notificationsStore';
import { formatStopwatch } from '../../../utils/format';
import { notify } from '../notify';
import StaffDeliveryChatDrawer, { type StaffChatTarget } from './StaffDeliveryChatDrawer';

/** How often the sound repeats while a call is not attended. */
const REPEAT_SOUND_MS = 20_000;

function WaitingTime({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return <>{formatStopwatch(Math.max(0, now - new Date(since).getTime()))}</>;
}

/** "Domicilio K7P2QX · Ana (Pedido #1017) — Calle 10 #43-20". */
function describe(request: DeliveryHelpRequest): string {
  const d = request.delivery;
  const who = [d.customerName, d.orderNumber && `pedido #${d.orderNumber}`]
    .filter(Boolean)
    .join(', ');
  return `Domicilio ${d.trackingCode}${who ? ` (${who})` : ''} · ${d.address}`;
}

function caller(request: DeliveryHelpRequest): string {
  return request.requestedBy === 'CUSTOMER'
    ? 'El cliente llama al restaurante'
    : `${request.delivery.courierName ?? 'El domiciliario'} pide ayuda`;
}

/**
 * Calls for attention on deliveries ("Llamar al restaurante" from the
 * customer's page or the courier's app). Shown on every screen of the POS,
 * since no one is watching Domicilios all the time: it sounds when a call
 * arrives and every 20 s until someone marks it attended, and says which
 * delivery needs looking at.
 */
export default function DeliveryHelpAlerts() {
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission, hasFeature } = usePermissions();
  // Calls are attended at a branch, not from "Todas las sedes" (review only).
  const reviewOnly = useAllBranchesReview();
  const enabled = hasFeature('deliveries') && hasPermission('deliveries.read') && !reviewOnly;
  const { data } = useDeliveryHelpRequests(enabled);
  const attend = useAttendDeliveryHelpRequest();
  const addNotification = useNotificationsStore((s) => s.addNotification);
  const [chat, setChat] = useState<StaffChatTarget | null>(null);
  const requests = enabled ? (data ?? []) : [];

  // Sounds for every call not heard before (including those already there on opening), then repeats.
  const heard = useRef(new Set<string>());
  const pendingKey = requests.map((request) => request.id).join(',');
  useEffect(() => {
    const fresh = requests.filter((request) => !heard.current.has(request.id));
    heard.current = new Set(requests.map((request) => request.id));
    if (fresh.length > 0) {
      playTableHelpAlertSound();
      for (const request of fresh) {
        notify(
          caller(request),
          describe(request),
          `delivery-help-${request.id}`,
          [300, 120, 300, 120, 300],
        );
        addNotification({
          title: caller(request),
          message: `${describe(request)}${request.reason ? ` — «${request.reason}»` : ''}`,
          level: 'warning',
          link: '/domicilios',
        });
      }
    }
    if (requests.length === 0) return;
    const interval = window.setInterval(playTableHelpAlertSound, REPEAT_SOUND_MS);
    return () => window.clearInterval(interval);
    // pendingKey stands for the list of calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  if (requests.length === 0 && !chat) return null;

  return (
    <>
      <Stack spacing={1} sx={{ mb: requests.length > 0 ? 2 : 0 }}>
        {requests.map((request) => (
          <Alert
            key={request.id}
            severity="warning"
            variant="filled"
            icon={<BellRing size={20} />}
            sx={{ alignItems: 'center', '& .MuiAlert-message': { fontWeight: 600 } }}
            action={
              <Stack direction="row" spacing={1}>
                <Button
                  color="inherit"
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    setChat({
                      deliveryId: request.deliveryId,
                      subtitle: describe(request),
                      open:
                        request.delivery.status !== 'DELIVERED' &&
                        request.delivery.status !== 'CANCELLED',
                    })
                  }
                >
                  Chat
                </Button>
                {request.delivery.customerPhone && request.requestedBy === 'CUSTOMER' && (
                  <Button
                    color="inherit"
                    size="small"
                    variant="outlined"
                    href={`tel:${request.delivery.customerPhone}`}
                  >
                    Llamar
                  </Button>
                )}
                <Button
                  color="inherit"
                  size="small"
                  variant="outlined"
                  loading={attend.isPending && attend.variables === request.id}
                  onClick={() =>
                    attend.mutate(request.id, {
                      onError: () =>
                        enqueueSnackbar('Esa llamada ya fue atendida', { variant: 'info' }),
                    })
                  }
                >
                  Atendido
                </Button>
              </Stack>
            }
          >
            {caller(request)} · <WaitingTime since={request.createdAt} />
            <br />
            {describe(request)}
            {request.reason && <> — «{request.reason}»</>}
          </Alert>
        ))}
      </Stack>
      <StaffDeliveryChatDrawer target={chat} onClose={() => setChat(null)} />
    </>
  );
}
