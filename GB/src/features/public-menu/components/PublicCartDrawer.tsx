import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { formatCOP } from '../../../utils/format';
import type { PublicMenuOptionGroup } from '../../../modules/public-menu/types/public-menu.types';
import { describeSelection, type PublicCartLine } from '../hooks/use-public-cart';

interface PublicCartDrawerProps {
  open: boolean;
  cart: PublicCartLine[];
  optionGroups: PublicMenuOptionGroup[];
  total: number;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  /** Absent (e.g. the generic /menu/:businessId preview, no NFC context) hides the confirm button entirely. */
  onSubmit?: () => void;
  submitting?: boolean;
  /** What the business calls "Arma tu combo", to name each combo in the cart. */
  comboName: string;
}

/** Customization is decided in ProductDetailDialog — this view only edits quantity or removes a line, never re-opens the option choice. */
export default function PublicCartDrawer({
  open,
  cart,
  optionGroups,
  total,
  onIncrement,
  onDecrement,
  onRemove,
  onClose,
  onSubmit,
  submitting,
  comboName,
}: PublicCartDrawerProps) {
  function describeLine(line: PublicCartLine): string {
    const parts = describeSelection(line, optionGroups);
    if (line.comboNumber) parts.unshift(`${comboName} ${line.comboNumber}`);
    return parts.join(' · ');
  }

  return (
    <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 400 } } } }}>
      <Stack sx={{ height: '100%' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Tu pedido
          </Typography>
          <IconButton onClick={onClose} size="small">
            <X size={20} />
          </IconButton>
        </Stack>
        <Divider />

        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {cart.length === 0 ? (
            <Stack sx={{ alignItems: 'center', justifyContent: 'center', height: '100%', p: 3, textAlign: 'center' }} spacing={1}>
              <ShoppingCart size={32} strokeWidth={1.5} />
              <Typography color="text.secondary">Todavía no has agregado productos.</Typography>
            </Stack>
          ) : (
            <Stack>
              {cart.map((line) => {
                const description = describeLine(line);
                return (
                  <Box key={line.id} sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {line.name}
                        </Typography>
                        {description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {description}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {formatCOP(line.unitPrice)} c/u
                        </Typography>
                      </Box>
                      <IconButton size="small" color="error" onClick={() => onRemove(line.id)}>
                        <Trash2 size={16} />
                      </IconButton>
                    </Stack>
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mt: 0.75 }}>
                      <IconButton size="small" onClick={() => onDecrement(line.id)}>
                        <Minus size={14} />
                      </IconButton>
                      <Typography sx={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{line.quantity}</Typography>
                      <IconButton size="small" onClick={() => onIncrement(line.id)}>
                        <Plus size={14} />
                      </IconButton>
                      <Box sx={{ flex: 1 }} />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formatCOP(line.unitPrice * line.quantity)}
                      </Typography>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>

        <Divider sx={{ borderBottomWidth: 2 }} />
        <Box sx={{ p: 2 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', mb: onSubmit ? 1.5 : 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Total
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {formatCOP(total)}
            </Typography>
          </Stack>
          {onSubmit && (
            <Button
              variant="contained"
              fullWidth
              size="large"
              disabled={cart.length === 0 || submitting}
              loading={submitting}
              onClick={onSubmit}
              sx={{ py: 1.5, fontSize: '1rem', fontWeight: 700 }}
            >
              Confirmar pedido
            </Button>
          )}
        </Box>
      </Stack>
    </Drawer>
  );
}
