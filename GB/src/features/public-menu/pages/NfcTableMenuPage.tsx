import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { BellRing, Check, MapPin, Store } from 'lucide-react';
import { useSnackbar } from 'notistack';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import ErrorState from '../../../components/common/ErrorState';
import { useResolveNfcTag } from '../../../modules/nfc-tags/hooks/use-resolve-nfc-tag';
import { useRequestTableHelp } from '../../../modules/table-help-requests/hooks/use-table-help-requests';
import type { OrderType } from '../../../modules/orders/types/order.types';
import PublicMenuBrowser from '../components/PublicMenuBrowser';

const DINE_TAKEAWAY_TYPES: Extract<OrderType, 'DINE_IN' | 'TAKEAWAY'>[] = ['DINE_IN', 'TAKEAWAY'];
const TYPE_LABELS: Record<'DINE_IN' | 'TAKEAWAY', string> = { DINE_IN: 'Comer aquí', TAKEAWAY: 'Para llevar' };

/** Tras llamar, el botón queda como "avisado" este tiempo: evita toques repetidos y confirma que la llamada salió. */
const HELP_CONFIRMATION_MS = 60_000;

/** Llama al personal: levanta una alerta sonora en Pedidos hasta que alguien atiende la mesa. */
function CallStaffButton({ token }: { token: string | undefined }) {
  const { enqueueSnackbar } = useSnackbar();
  const requestHelp = useRequestTableHelp(token);
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    if (!notified) return;
    const timeout = window.setTimeout(() => setNotified(false), HELP_CONFIRMATION_MS);
    return () => window.clearTimeout(timeout);
  }, [notified]);

  return (
    <Button
      variant={notified ? 'contained' : 'outlined'}
      color={notified ? 'success' : 'primary'}
      startIcon={notified ? <Check size={18} /> : <BellRing size={18} />}
      loading={requestHelp.isPending}
      disabled={notified}
      onClick={() =>
        requestHelp.mutate(undefined, {
          onSuccess: () => setNotified(true),
          onError: () =>
            enqueueSnackbar('No pudimos avisar al personal. Intenta de nuevo.', { variant: 'error' }),
        })
      }
      sx={{ fontWeight: 700, '&.Mui-disabled': notified ? { bgcolor: 'success.main', color: 'success.contrastText' } : {} }}
    >
      {notified ? 'Ya avisamos al personal' : 'Llamar al personal'}
    </Button>
  );
}

/**
 * Scanned from a gallo NFC point — resolves the token to a fixed
 * business/branch/table context the customer never edits directly (BR: "el
 * cliente no podrá cambiar manualmente la mesa asociada"). "Para llevar"
 * still preserves that NFC origin internally, it just changes how the table
 * is presented (delivery at the counter instead of the table).
 *
 * A table without self-service gets the same menu to browse, but cannot send
 * the order: a waiter takes it. Either way it can call the staff.
 */
export default function NfcTableMenuPage() {
  const { token } = useParams<{ token: string }>();
  const { data: resolved, isLoading, isError } = useResolveNfcTag(token);
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN');
  const selfService = resolved?.selfServiceEnabled ?? false;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: { xs: 3, sm: 6 }, px: 2 }}>
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>
        {isLoading && <LoadingSkeleton variant="page" />}

        {isError && (
          <ErrorState
            title="Enlace no disponible"
            description="Este enlace ya no está activo. Pide ayuda al personal para escanear de nuevo."
          />
        )}

        {resolved && (
          <Stack sx={{ alignItems: 'center', textAlign: 'center', mb: 3 }} spacing={1.5}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {resolved.businessName}
            </Typography>

            {selfService && (
              <ToggleButtonGroup
                exclusive
                size="small"
                value={orderType}
                onChange={(_, next: 'DINE_IN' | 'TAKEAWAY' | null) => next && setOrderType(next)}
              >
                {DINE_TAKEAWAY_TYPES.map((type) => (
                  <ToggleButton key={type} value={type} sx={{ fontWeight: 700, px: 2.5 }}>
                    {TYPE_LABELS[type]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}

            {!selfService || orderType === 'DINE_IN' ? (
              <Chip
                icon={<MapPin size={16} />}
                label={resolved.tableName ?? `Mesa ${resolved.tableNumber}`}
                color="primary"
                sx={{ fontWeight: 700 }}
              />
            ) : (
              <Chip icon={<Store size={16} />} label="Entrega en mostrador" sx={{ fontWeight: 700 }} />
            )}

            {!selfService && (
              <Typography variant="body2" color="text.secondary">
                Revisa el menú y un mesero tomará tu pedido en la mesa.
              </Typography>
            )}

            <CallStaffButton token={token} />
          </Stack>
        )}
      </Box>

      {resolved && (
        <PublicMenuBrowser
          businessId={resolved.businessId}
          showMenuLabel={false}
          // Sin autoservicio el menú es solo de consulta: ni agregar productos, ni carrito, ni confirmar.
          readOnly={!selfService}
          token={selfService ? token : undefined}
          orderType={selfService ? orderType : undefined}
        />
      )}
    </Box>
  );
}
