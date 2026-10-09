import { useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import type { SxProps, Theme } from '@mui/material/styles';
import { BellRing } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import { playTableHelpAlertSound } from '../../../modules/orders/utils/notification-sound';
import {
  useAttendTableHelpRequest,
  usePendingTableHelpRequests,
} from '../../../modules/table-help-requests/hooks/use-table-help-requests';
import { formatStopwatch } from '../../../utils/format';

/** Cada cuánto se repite el sonido mientras quede alguna mesa sin atender. */
const REPEAT_SOUND_MS = 20_000;

/** Cuánto lleva esperando la mesa. */
function WaitingTime({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return <>{formatStopwatch(Math.max(0, now - new Date(since).getTime()))}</>;
}

interface TableHelpAlertsProps {
  branchId: string | null | undefined;
  /** {número de mesa: nombre} — el mismo que usa el resto de Pedidos. */
  tableNames: Record<string, string>;
  /** Espaciado de la franja según la pantalla que la aloja; solo ocupa lugar cuando hay llamadas. */
  sx?: SxProps<Theme>;
}

/**
 * Las mesas que pidieron ayuda desde su menú NFC. Suena cuando llega una
 * llamada nueva y sigue sonando cada cierto tiempo hasta que alguien marca
 * la mesa como atendida.
 */
export default function TableHelpAlerts({ branchId, tableNames, sx }: TableHelpAlertsProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = usePermissions();
  const { data } = usePendingTableHelpRequests(branchId);
  const attend = useAttendTableHelpRequest();
  const requests = data ?? [];

  // Suena por cada llamada que no se había visto antes, incluidas las que ya estaban al abrir la pantalla.
  const heardIds = useRef(new Set<string>());
  const pendingKey = requests.map((request) => request.id).join(',');
  useEffect(() => {
    const ids = pendingKey ? pendingKey.split(',') : [];
    const hasNew = ids.some((id) => !heardIds.current.has(id));
    heardIds.current = new Set(ids);
    if (hasNew) playTableHelpAlertSound();
    if (ids.length === 0) return;

    const interval = window.setInterval(playTableHelpAlertSound, REPEAT_SOUND_MS);
    return () => window.clearInterval(interval);
  }, [pendingKey]);

  if (requests.length === 0) return null;

  return (
    <Stack spacing={1} sx={sx ?? { mb: 2 }}>
      {requests.map((request) => (
        <Alert
          key={request.id}
          severity="warning"
          variant="filled"
          icon={<BellRing size={20} />}
          sx={{ alignItems: 'center', fontWeight: 700 }}
          action={
            hasPermission('orders.update') ? (
              <Button
                color="inherit"
                size="small"
                variant="outlined"
                loading={attend.isPending && attend.variables === request.id}
                onClick={() =>
                  attend.mutate(request.id, {
                    onError: () => enqueueSnackbar('Esa mesa ya fue atendida', { variant: 'info' }),
                  })
                }
              >
                Atendida
              </Button>
            ) : undefined
          }
        >
          {tableNames[request.tableNumber] ?? `Mesa ${request.tableNumber}`} pide ayuda del personal ·{' '}
          <WaitingTime since={request.createdAt} />
        </Alert>
      ))}
    </Stack>
  );
}
