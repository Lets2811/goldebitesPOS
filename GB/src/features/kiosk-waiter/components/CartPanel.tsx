import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import { Send } from 'lucide-react';
import { formatCOP } from '../../../utils/format';
import { ORDER_TYPE_LABELS } from '../../../modules/orders/order-status';
import type { OrderType } from '../../../modules/orders/types/order.types';
import OrderCartList from '../../orders/components/OrderCartList';
import TableNumberPicker from './TableNumberPicker';
import type { ProductOptionGroup } from '../../../modules/option-groups/types/option-group.types';

export interface CartLine {
  /** Unique per cart line — NOT the same as productId, since one product can appear as several
   *  independently-customized lines (e.g. two burgers with different sauces each). */
  id: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  /** The option groups this unit can be customized with, and how many of each. */
  optionGroups: ProductOptionGroup[];
  optionItemIds: string[];
}

interface CartPanelProps {
  cart: CartLine[];
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleOption: (id: string, groupId: string, itemId: string) => void;
  tableNumber: string;
  onTableNumberChange: (value: string) => void;
  tableCount?: number;
  occupiedTables?: Set<string>;
  orderType: OrderType;
  onOrderTypeChange: (value: OrderType) => void;
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  orderNotes: string;
  onOrderNotesChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}

const CART_ORDER_TYPES: OrderType[] = ['DINE_IN', 'TAKEAWAY'];

export default function CartPanel({
  cart,
  onIncrement,
  onDecrement,
  onRemove,
  onToggleOption,
  tableNumber,
  onTableNumberChange,
  tableCount,
  occupiedTables,
  orderType,
  onOrderTypeChange,
  customerName,
  onCustomerNameChange,
  orderNotes,
  onOrderNotesChange,
  onSubmit,
  submitting,
}: CartPanelProps) {
  const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const tableIsOccupied = orderType === 'DINE_IN' && Boolean(tableNumber) && (occupiedTables?.has(tableNumber) ?? false);
  const canSubmit = cart.length > 0 && !submitting && !tableIsOccupied;

  return (
    <Stack sx={{ height: '100%' }}>
      <Box sx={{ p: 1.5 }}>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={orderType}
          onChange={(_, next: OrderType | null) => next && onOrderTypeChange(next)}
        >
          {CART_ORDER_TYPES.map((type) => (
            <ToggleButton key={type} value={type} sx={{ fontWeight: 700 }}>
              {ORDER_TYPE_LABELS[type]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {orderType === 'DINE_IN' && (
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <TableNumberPicker
            value={tableNumber}
            onChange={onTableNumberChange}
            tableCount={tableCount}
            occupiedTables={occupiedTables}
          />
        </Box>
      )}

      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <TextField
          value={customerName}
          onChange={(e) => onCustomerNameChange(e.target.value)}
          label="Nombre del cliente (opcional)"
          fullWidth
          size="small"
        />
      </Box>

      <Divider />

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <OrderCartList
          cart={cart}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
          onRemove={onRemove}
          onToggleOption={onToggleOption}
          emptyMessage="Toca un producto para agregarlo al pedido."
        />
      </Box>

      <Divider />

      <Box sx={{ px: 1.5, py: 1.25 }}>
        <TextField
          value={orderNotes}
          onChange={(e) => onOrderNotesChange(e.target.value)}
          label="Comentario del pedido (opcional)"
          placeholder="Ej. Sin cebolla, cliente frecuente..."
          multiline
          minRows={2}
          fullWidth
          size="small"
        />
      </Box>

      <Divider sx={{ borderBottomWidth: 2 }} />

      <Box sx={{ p: 2 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Total
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {formatCOP(total)}
          </Typography>
        </Stack>
        {tableIsOccupied && (
          <Typography variant="caption" color="error.main" sx={{ display: 'block', mb: 1, fontWeight: 700 }}>
            Esta mesa ya tiene un pedido activo — elige otra o usa "Agregar productos" desde ese pedido.
          </Typography>
        )}
        <Button
          variant="contained"
          color="primary"
          fullWidth
          size="large"
          startIcon={<Send size={22} />}
          disabled={!canSubmit}
          loading={submitting}
          onClick={onSubmit}
          sx={{
            py: 2,
            fontSize: '1.15rem',
            fontWeight: 800,
            borderRadius: 2,
            boxShadow: 3,
            textTransform: 'none',
          }}
        >
          Enviar a cocina
        </Button>
      </Box>
    </Stack>
  );
}
