import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Copy, MessageCircle, Share2 } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useCurrentBusiness } from '../../../modules/businesses/hooks/use-current-business';
import type { Delivery } from '../../../modules/deliveries/types/delivery.types';
import { formatCOP } from '../../../utils/format';
import { trackingMessage, trackingUrl, whatsappUrl } from '../share-tracking';

interface ShareTrackingDialogProps {
  delivery: Delivery | null;
  /** Shown right after creating it: the title says so. */
  justCreated?: boolean;
  onClose: () => void;
}

/**
 * The customer's tracking link, for the business to send: by WhatsApp to the
 * customer's phone, with the phone's share sheet, or copied.
 */
export default function ShareTrackingDialog({ delivery, justCreated, onClose }: ShareTrackingDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const business = useCurrentBusiness();
  if (!delivery) return null;

  const message = trackingMessage(delivery, business.data?.name);
  const copy = (text: string, what: string) =>
    void navigator.clipboard
      .writeText(text)
      .then(() => enqueueSnackbar(`${what} copiado`, { variant: 'success' }))
      .catch(() => enqueueSnackbar('No se pudo copiar', { variant: 'error' }));

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{justCreated ? 'Domicilio creado' : 'Enlace de seguimiento'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {justCreated && (
            <Typography variant="body2" color="text.secondary">
              Valor {formatCOP(delivery.fee)}
              {delivery.courier ? ` · asignado a ${delivery.courier.name}` : ' · sin domiciliario asignado'}
            </Typography>
          )}
          <Typography variant="body2">
            Envíale al cliente este enlace para que siga su domicilio en el mapa y le escriba al domiciliario. No
            necesita cuenta.
          </Typography>
          <Box sx={{ textAlign: 'center', py: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary">
              Código
            </Typography>
            <Typography sx={{ fontSize: 32, fontWeight: 800, letterSpacing: 6 }}>{delivery.trackingCode}</Typography>
          </Box>
          <TextField
            size="small"
            label="Enlace"
            value={trackingUrl(delivery.trackingCode)}
            slotProps={{ htmlInput: { readOnly: true }, inputLabel: { shrink: true } }}
            onFocus={(e) => e.target.select()}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            {delivery.customerPhone && (
              <Button
                variant="contained"
                startIcon={<MessageCircle size={16} />}
                href={whatsappUrl(delivery.customerPhone, message)}
                target="_blank"
                rel="noopener"
                fullWidth
              >
                WhatsApp
              </Button>
            )}
            <Button variant="outlined" startIcon={<Copy size={16} />} onClick={() => copy(message, 'Mensaje')} fullWidth>
              Copiar
            </Button>
            {'share' in navigator && (
              <Button
                variant="outlined"
                startIcon={<Share2 size={16} />}
                onClick={() => void navigator.share({ title: 'Sigue tu domicilio', text: message }).catch(() => {})}
                fullWidth
              >
                Compartir
              </Button>
            )}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Listo</Button>
      </DialogActions>
    </Dialog>
  );
}
