import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { useSnackbar } from 'notistack';
import FormDrawer from '../../../components/common/FormDrawer';
import CategoryTabs from '../../kiosk-waiter/components/CategoryTabs';
import ProductGrid from '../../kiosk-waiter/components/ProductGrid';
import OrderCartList from './OrderCartList';
import { cartLineToOrderItem, useCartLines } from '../../../modules/orders/hooks/use-cart-lines';
import { useRequiredOptionCheck } from '../../../modules/option-groups/hooks/use-required-option-check';
import { formatCOP } from '../../../utils/format';
import type { OrderWithItems, CreateOrderItemPayload } from '../../../modules/orders/types/order.types';

interface AddOrderItemsDrawerProps {
  open: boolean;
  order: OrderWithItems | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (items: CreateOrderItemPayload[]) => void;
}

/** Adds products to an already-created order (a running tab) — same picker/cart as the waiter kiosk. */
export default function AddOrderItemsDrawer({
  open,
  order,
  loading,
  onClose,
  onSubmit,
}: AddOrderItemsDrawerProps) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const { cart, addToCart, toggleOption, increment, decrement, remove, clear } = useCartLines();
  const { enqueueSnackbar } = useSnackbar();
  const checkRequiredOptions = useRequiredOptionCheck();

  useEffect(() => {
    if (open) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear() is a fresh function every render; only re-run when the drawer opens.
  }, [open]);

  const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const canSubmit = cart.length > 0 && !loading;

  function handleSubmit() {
    const missingOption = checkRequiredOptions(cart);
    if (missingOption) {
      enqueueSnackbar(missingOption, { variant: 'error' });
      return;
    }
    onSubmit(cart.map(cartLineToOrderItem));
  }

  if (!order) return null;

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={`Agregar productos — Pedido #${order.orderNumber}`}
      subtitle="Se suman a la cuenta actual, sin tocar lo que ya se pidió."
      submitLabel={cart.length > 0 ? `Agregar (${formatCOP(total)})` : 'Agregar'}
      submitDisabled={!canSubmit}
      loading={loading}
      width={760}
    >
      <Stack direction="row" sx={{ height: '65vh', gap: 2 }}>
        <Stack
          sx={{
            flex: 1,
            minWidth: 0,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          <CategoryTabs value={categoryId} onChange={setCategoryId} />
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            <ProductGrid categoryId={categoryId} onSelect={addToCart} />
          </Box>
        </Stack>
        <Box
          sx={{
            width: 320,
            flexShrink: 0,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflowY: 'auto',
          }}
        >
          <OrderCartList
            cart={cart}
            onIncrement={increment}
            onDecrement={decrement}
            onRemove={remove}
            onToggleOption={toggleOption}
          />
        </Box>
      </Stack>
    </FormDrawer>
  );
}
