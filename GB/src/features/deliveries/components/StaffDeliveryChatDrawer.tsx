import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { X } from 'lucide-react';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import DeliveryChat from './DeliveryChat';

const STAFF_QUICK_REPLIES = [
  'Ya revisamos tu domicilio',
  'Tu pedido va en camino',
  'Te llamamos en un momento',
  'Disculpa la demora',
];

export interface StaffChatTarget {
  deliveryId: string;
  /** What the header says: address, customer... */
  subtitle: string;
  open: boolean;
}

/** The chat of a delivery as the restaurant sees it: it can write while the delivery is open. */
export default function StaffDeliveryChatDrawer({
  target,
  onClose,
}: {
  target: StaffChatTarget | null;
  onClose: () => void;
}) {
  const { hasPermission } = usePermissions();
  return (
    <Drawer
      anchor="right"
      open={target !== null}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 420 } } } }}
    >
      {target && (
        <Stack sx={{ height: '100%' }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800 }}>Chat del domicilio</Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="p">
                {target.subtitle}
              </Typography>
            </Box>
            <IconButton onClick={onClose}>
              <X size={18} />
            </IconButton>
          </Stack>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <DeliveryChat
              channel={{ as: 'STAFF', deliveryId: target.deliveryId }}
              canWrite={target.open && hasPermission('deliveries.manage')}
              quickReplies={STAFF_QUICK_REPLIES}
              height="100%"
            />
          </Box>
        </Stack>
      )}
    </Drawer>
  );
}
