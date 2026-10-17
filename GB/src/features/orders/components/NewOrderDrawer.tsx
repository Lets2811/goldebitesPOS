import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import FormDrawer from '../../../components/common/FormDrawer';
import CurrencyField from '../../../components/common/CurrencyField';
import CategoryTabs from '../../kiosk-waiter/components/CategoryTabs';
import ProductGrid from '../../kiosk-waiter/components/ProductGrid';
import TableNumberPicker from '../../kiosk-waiter/components/TableNumberPicker';
import OrderCartList from './OrderCartList';
import { newOrderSchema, type NewOrderFormValues } from '../schemas/orderSchema';
import { ORDER_TYPE_LABELS } from '../../../modules/orders/order-status';
import { useCustomers } from '../../../modules/customers/hooks/use-customers';
import { useCartLines } from '../../../modules/orders/hooks/use-cart-lines';
import { useOccupiedTables } from '../../../modules/orders/hooks/use-occupied-tables';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useBranch } from '../../../modules/branches/hooks/use-branch';
import { formatCOP } from '../../../utils/format';
import { useSnackbar } from 'notistack';
import { useRequiredOptionCheck } from '../../../modules/option-groups/hooks/use-required-option-check';

interface NewOrderDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: NewOrderFormValues) => void;
}

const defaultValues: NewOrderFormValues = {
  customerId: '',
  customerName: '',
  orderType: 'DINE_IN',
  tableNumber: '',
  deliveryAddress: '',
  deliveryInstructions: '',
  discountAmount: 0,
  deliveryFee: 0,
  notes: '',
  items: [],
};

export default function NewOrderDrawer({ open, onClose, onSubmit }: NewOrderDrawerProps) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const branchId = useAuthStore((s) => s.user?.branchId);
  const { data: branch } = useBranch(branchId);
  const occupiedTables = useOccupiedTables(branchId);
  const { data: customersData } = useCustomers({ limit: 100 });
  const customers = customersData?.data ?? [];
  const { cart, addToCart, toggleOption, increment, decrement, remove, clear } = useCartLines();
  const { enqueueSnackbar } = useSnackbar();
  const checkRequiredOptions = useRequiredOptionCheck();

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NewOrderFormValues>({ resolver: zodResolver(newOrderSchema), defaultValues });

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form's watch() is inherently non-memoizable; this is expected.
  const orderType = watch('orderType');
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form's watch() is inherently non-memoizable; this is expected.
  const tableNumber = watch('tableNumber');
  const tableIsOccupied = orderType === 'DINE_IN' && Boolean(tableNumber) && occupiedTables.has(tableNumber ?? '');

  useEffect(() => {
    if (open) {
      reset(defaultValues);
      clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear()/reset() are fresh every render; only re-run when the drawer opens.
  }, [open]);

  // Keeps the zod-validated `items` field in sync with the product-grid cart (the actual source of truth here).
  useEffect(() => {
    setValue(
      'items',
      cart.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        optionItemIds: line.optionItemIds,
      })),
      { shouldValidate: false },
    );
  }, [cart, setValue]);

  const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  const submit = handleSubmit((values) => {
    const missingOption = checkRequiredOptions(cart);
    if (missingOption) {
      enqueueSnackbar(missingOption, { variant: 'error' });
      return;
    }
    onSubmit(values);
  });

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title="Nuevo pedido"
      subtitle="Registra un pedido manual en mesa, para recoger o a domicilio."
      submitLabel={cart.length > 0 ? `Crear pedido (${formatCOP(total)})` : 'Crear pedido'}
      submitDisabled={cart.length === 0 || tableIsOccupied}
      loading={isSubmitting}
      width={960}
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

        <Stack sx={{ width: 380, flexShrink: 0, overflowY: 'auto', gap: 2 }}>
          <Stack spacing={2}>
            <Controller
              name="customerId"
              control={control}
              render={({ field }) => (
                <TextField {...field} value={field.value ?? ''} label="Cliente registrado (opcional)" select fullWidth size="small">
                  <MenuItem value="">Ninguno</MenuItem>
                  {customers.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName ?? ''}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="customerName"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Nombre del cliente (opcional)" fullWidth size="small" />
              )}
            />

            <Controller
              name="orderType"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Tipo de pedido" fullWidth size="small">
                  {Object.entries(ORDER_TYPE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            {(orderType === 'DINE_IN' || orderType === 'CAR_SERVICE') && (
              <Controller
                name="tableNumber"
                control={control}
                render={({ field }) =>
                  orderType === 'DINE_IN' ? (
                    <TableNumberPicker
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      tableCount={branch?.tableCount}
                      occupiedTables={occupiedTables}
                    />
                  ) : (
                    <TextField {...field} label="Placa del vehículo" fullWidth size="small" />
                  )
                }
              />
            )}

            {orderType === 'DELIVERY' && (
              <Stack spacing={2}>
                <Controller
                  name="deliveryAddress"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Dirección de entrega"
                      fullWidth
                      size="small"
                      error={Boolean(errors.deliveryAddress)}
                      helperText={errors.deliveryAddress?.message}
                    />
                  )}
                />
                <Controller
                  name="deliveryInstructions"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Instrucciones de entrega" fullWidth size="small" />
                  )}
                />
                <Controller
                  name="deliveryFee"
                  control={control}
                  render={({ field }) => (
                    <CurrencyField {...field} value={field.value ?? ''} label="Costo de domicilio (COP)" fullWidth size="small" />
                  )}
                />
              </Stack>
            )}

            <Controller
              name="discountAmount"
              control={control}
              render={({ field }) => (
                <CurrencyField {...field} value={field.value ?? ''} label="Descuento (COP)" fullWidth size="small" />
              )}
            />

            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Notas del pedido" multiline minRows={2} fullWidth size="small" />
              )}
            />
          </Stack>

          {tableIsOccupied && (
            <Typography variant="caption" color="error.main" sx={{ fontWeight: 700 }}>
              Esta mesa ya tiene un pedido activo — elige otra o usa "Agregar productos" desde ese pedido.
            </Typography>
          )}

          <Divider />

          <Box sx={{ flex: 1, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            {errors.items?.root && (
              <Typography variant="caption" color="error" sx={{ px: 1.5, pt: 1, display: 'block' }}>
                {errors.items.root.message}
              </Typography>
            )}
            <OrderCartList
              cart={cart}
              onIncrement={increment}
              onDecrement={decrement}
              onRemove={remove}
              onToggleOption={toggleOption}
            />
          </Box>
        </Stack>
      </Stack>
    </FormDrawer>
  );
}
