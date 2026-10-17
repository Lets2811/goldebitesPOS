import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatCOP } from '../../../utils/format';
import CartLineOptionPicker from '../../../modules/option-groups/components/CartLineOptionPicker';
import type { CartLine } from '../../kiosk-waiter/components/CartPanel';

interface OrderCartListProps {
  cart: CartLine[];
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleOption: (id: string, groupId: string, itemId: string) => void;
  emptyMessage?: string;
}

/** Cart line list with quantity steppers and option chips — same behavior as the waiter kiosk's cart. */
export default function OrderCartList({
  cart,
  onIncrement,
  onDecrement,
  onRemove,
  onToggleOption,
  emptyMessage = 'Toca un producto para agregarlo.',
}: OrderCartListProps) {
  if (cart.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <Stack spacing={0}>
      {cart.map((line) => (
        <Box
          key={line.id}
          sx={{
            px: 1.5,
            py: 1.25,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {line.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatCOP(line.unitPrice)} c/u
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => onDecrement(line.id)}>
              <Minus size={16} />
            </IconButton>
            <Typography sx={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{line.quantity}</Typography>
            <IconButton size="small" onClick={() => onIncrement(line.id)}>
              <Plus size={16} />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => onRemove(line.id)}>
              <Trash2 size={16} />
            </IconButton>
          </Stack>

          <CartLineOptionPicker line={line} onToggle={(groupId, itemId) => onToggleOption(line.id, groupId, itemId)} />
        </Box>
      ))}
    </Stack>
  );
}
