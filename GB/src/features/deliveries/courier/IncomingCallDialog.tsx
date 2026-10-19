import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { keyframes } from '@mui/material/styles';
import { MessageCircle, PhoneCall } from 'lucide-react';
import { useMarkCourierCallsSeen, useMyCourierCalls } from '../../../modules/deliveries/hooks/use-deliveries';
import type { CourierCall } from '../../../modules/deliveries/types/delivery.types';
import { playTableHelpAlertSound } from '../../../modules/orders/utils/notification-sound';

/** How often it rings and vibrates while the call is not seen. */
const RING_MS = 2_500;

const pulse = keyframes`
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.6); }
  70% { transform: scale(1.06); box-shadow: 0 0 0 28px rgba(212, 175, 55, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(212, 175, 55, 0); }
`;

function who(call: CourierCall): string {
  return call.calledBy === 'CUSTOMER'
    ? `${call.delivery.customerName ?? 'Tu cliente'} te está llamando`
    : `${call.staffName ? `${call.staffName}, del restaurante,` : 'El restaurante'} te está llamando`;
}

/**
 * A call from the restaurant or the customer: full screen, ringing and
 * vibrating until the courier marks it seen. The phone's push notification
 * covers the case where this app is closed; this covers it being open.
 */
export default function IncomingCallDialog({ onOpenChat }: { onOpenChat: (deliveryId: string) => void }) {
  const { data: calls = [] } = useMyCourierCalls();
  const markSeen = useMarkCourierCallsSeen();
  const call = calls[0] ?? null;
  const ringing = call?.id ?? null;

  useEffect(() => {
    if (!ringing) return;
    const ring = () => {
      playTableHelpAlertSound();
      try {
        navigator.vibrate?.([500, 200, 500, 200, 500]);
      } catch {
        // iPhone browsers cannot vibrate from a page.
      }
    };
    ring();
    const interval = window.setInterval(ring, RING_MS);
    return () => {
      window.clearInterval(interval);
      try {
        navigator.vibrate?.(0);
      } catch {
        // Nothing to stop.
      }
    };
  }, [ringing]);

  if (!call) return null;

  const seen = (then?: () => void) =>
    markSeen.mutate(call.deliveryId, {
      onSettled: () => then?.(),
    });

  return (
    <Dialog open fullScreen>
      <Stack
        spacing={3}
        sx={{
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          p: 3,
          bgcolor: 'background.default',
        }}
      >
        <Box
          sx={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            animation: `${pulse} 1.2s infinite`,
          }}
        >
          <PhoneCall size={52} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {who(call)}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Domicilio <strong>{call.delivery.trackingCode}</strong> · {call.delivery.address}
          </Typography>
          {calls.length > 1 && (
            <Typography variant="caption" color="text.secondary">
              Y {calls.length - 1} llamada{calls.length > 2 ? 's' : ''} más
            </Typography>
          )}
        </Box>
        <Stack spacing={1.5} sx={{ width: '100%', maxWidth: 360 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<MessageCircle size={20} />}
            onClick={() => seen(() => onOpenChat(call.deliveryId))}
            sx={{ py: 1.5, fontWeight: 800 }}
          >
            Abrir el chat
          </Button>
          <Button variant="outlined" size="large" loading={markSeen.isPending} onClick={() => seen()} sx={{ py: 1.5 }}>
            Visto
          </Button>
        </Stack>
      </Stack>
    </Dialog>
  );
}
