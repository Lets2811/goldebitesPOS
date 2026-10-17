import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import { Minus, Plus, Trash2, ShoppingCart, CreditCard } from 'lucide-react';
import { formatCOP } from '../../../utils/format';
import CartLineOptionPicker from '../../../modules/option-groups/components/CartLineOptionPicker';
import type { CartLine } from '../../kiosk-waiter/components/CartPanel';

interface CarServiceCartPanelProps {
  cart: CartLine[];
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleOption: (id: string, groupId: string, itemId: string) => void;
  vehicleTag: string;
  onVehicleTagChange: (value: string) => void;
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export default function CarServiceCartPanel({
  cart,
  onIncrement,
  onDecrement,
  onRemove,
  onToggleOption,
  vehicleTag,
  onVehicleTagChange,
  customerName,
  onCustomerNameChange,
  onSubmit,
  submitting,
}: CarServiceCartPanelProps) {
  const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const canSubmit = cart.length > 0 && !submitting;

  return (
    <Stack sx={{ height: '100%', bgcolor: 'background.default' }}>
      <Box sx={{ p: 2, pb: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
          <ShoppingCart size={20} />
          <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
            Tu pedido {itemCount > 0 && `(${itemCount})`}
          </Typography>
        </Stack>
        <TextField
          fullWidth
          label="Placa o descripción del vehículo"
          placeholder="Ej. ABC-123 / Camioneta gris"
          value={vehicleTag}
          onChange={(e) => onVehicleTagChange(e.target.value)}
          sx={{ '& .MuiInputBase-input': { fontWeight: 700 }, mb: 1.5 }}
        />
        <TextField
          fullWidth
          label="Nombre del cliente (opcional)"
          value={customerName}
          onChange={(e) => onCustomerNameChange(e.target.value)}
        />
      </Box>

      <Divider sx={{ borderWidth: 1 }} />

      <Stack spacing={0} sx={{ flex: 1, overflowY: 'auto' }}>
        {cart.length === 0 ? (
          <Stack sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', p: 3, opacity: 0.5 }}>
            <ShoppingCart size={40} strokeWidth={1.3} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, textAlign: 'center' }}>
              Toca un producto del menú para agregarlo
            </Typography>
          </Stack>
        ) : (
          cart.map((line) => (
            <Box
              key={line.id}
              sx={{
                px: 2,
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '1rem' }} noWrap>
                    {line.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatCOP(line.unitPrice)} c/u
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <Stepper icon={<Minus size={18} />} onClick={() => onDecrement(line.id)} />
                  <Typography sx={{ minWidth: 26, textAlign: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
                    {line.quantity}
                  </Typography>
                  <Stepper icon={<Plus size={18} />} onClick={() => onIncrement(line.id)} />
                  <ButtonBase
                    onClick={() => onRemove(line.id)}
                    sx={{ p: 1, borderRadius: 2, color: 'error.main', ml: 0.5 }}
                  >
                    <Trash2 size={18} />
                  </ButtonBase>
                </Stack>
              </Box>

              <CartLineOptionPicker large line={line} onToggle={(groupId, itemId) => onToggleOption(line.id, groupId, itemId)} />
            </Box>
          ))
        )}
      </Stack>

      <Box
        sx={{
          p: 2.5,
          borderTop: '2px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }} color="text.secondary">
            Total
          </Typography>
          <Typography sx={{ fontWeight: 900, fontSize: '2.4rem', lineHeight: 1 }}>
            {formatCOP(total)}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          fullWidth
          startIcon={<CreditCard size={22} />}
          disabled={!canSubmit}
          loading={submitting}
          onClick={onSubmit}
          sx={{ py: 2.25, fontSize: '1.15rem', fontWeight: 800, borderRadius: 3 }}
        >
          Cobrar y enviar a cocina
        </Button>
      </Box>
    </Stack>
  );
}

function Stepper({ icon, onClick }: { icon: React.ReactNode; onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: '2px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </ButtonBase>
  );
}
