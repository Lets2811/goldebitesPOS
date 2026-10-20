import { useEffect, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { Plus, Trash2 } from 'lucide-react';
import FormDrawer from '../../../components/common/FormDrawer';
import { editOrderItemsSchema, type EditOrderItemsFormValues } from '../schemas/orderSchema';
import { useBranchMenu } from '../../../modules/products/branch-menu';
import { formatCOP } from '../../../utils/format';
import type { OrderWithItems } from '../../../modules/orders/types/order.types';

interface EditOrderItemsDrawerProps {
  open: boolean;
  order: OrderWithItems | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: EditOrderItemsFormValues) => void;
}

export default function EditOrderItemsDrawer({
  open,
  order,
  loading,
  onClose,
  onSubmit,
}: EditOrderItemsDrawerProps) {
  // The order's branch menu, at its prices.
  const { data: menu } = useBranchMenu(order?.branchId ?? null);
  const products = useMemo(() => menu ?? [], [menu]);
  // What the order already has stays pickable even if it ran out since.
  const inOrder = useMemo(
    () => new Set((order?.items ?? []).map((item) => item.productId)),
    [order],
  );

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EditOrderItemsFormValues>({
    resolver: zodResolver(editOrderItemsSchema),
    defaultValues: { items: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form's watch() is inherently non-memoizable; this is expected.
  const items = watch('items');

  useEffect(() => {
    if (open && order) {
      reset({
        items: order.items.map((item) => ({
          productId: item.productId ?? '',
          quantity: item.quantity,
          notes: item.notes ?? '',
          // Kept as they were, so editing quantities doesn't drop what was picked.
          optionItemIds: item.optionSelections.flatMap((selection) => selection.itemIds),
        })),
      });
    }
  }, [open, order, reset]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const estimatedSubtotal = items.reduce((sum, item) => {
    const product = productById.get(item.productId);
    return product ? sum + product.salePrice * (item.quantity || 0) : sum;
  }, 0);

  const submit = handleSubmit((values) => onSubmit(values));

  if (!order) return null;

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={`Editar pedido #${order.orderNumber}`}
      subtitle="Puedes editar los productos mientras el pedido siga activo (no entregado ni cancelado)."
      submitLabel="Guardar cambios"
      loading={isSubmitting || loading}
      width={560}
    >
      <Stack spacing={2.5}>
        <Box>
          <Stack
            direction="row"
            sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Productos
            </Typography>
            <Button
              size="small"
              startIcon={<Plus size={14} />}
              onClick={() => append({ productId: '', quantity: 1, notes: '' })}
            >
              Agregar producto
            </Button>
          </Stack>
          {errors.items?.root && (
            <Typography variant="caption" color="error">
              {errors.items.root.message}
            </Typography>
          )}
          <Stack spacing={1.5}>
            {fields.map((field, index) => (
              <Stack key={field.id} spacing={1}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Controller
                    name={`items.${index}.productId`}
                    control={control}
                    render={({ field: selectField }) => (
                      <TextField
                        {...selectField}
                        onChange={(event) => {
                          selectField.onChange(event);
                          // Another product: what was picked for the old one doesn't apply.
                          setValue(`items.${index}.optionItemIds`, []);
                        }}
                        select
                        label="Producto"
                        fullWidth
                        size="small"
                      >
                        <MenuItem value="">Selecciona…</MenuItem>
                        {products.map((p) => (
                          <MenuItem
                            key={p.id}
                            value={p.id}
                            disabled={p.outOfStock && !inOrder.has(p.id)}
                          >
                            {p.name} — {formatCOP(p.salePrice)}
                            {p.outOfStock ? ' (agotado)' : ''}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                  <Controller
                    name={`items.${index}.quantity`}
                    control={control}
                    render={({ field: qtyField }) => (
                      <TextField
                        {...qtyField}
                        label="Cant."
                        type="number"
                        size="small"
                        sx={{ width: 90 }}
                      />
                    )}
                  />
                  <IconButton
                    size="small"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </Stack>
                <Controller
                  name={`items.${index}.notes`}
                  control={control}
                  render={({ field: notesField }) => (
                    <TextField
                      {...notesField}
                      label="Nota del producto (opcional)"
                      size="small"
                      fullWidth
                    />
                  )}
                />
              </Stack>
            ))}
          </Stack>
        </Box>

        <Stack direction="row" sx={{ justifyContent: 'space-between', pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Subtotal estimado
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {formatCOP(estimatedSubtotal)}
          </Typography>
        </Stack>
      </Stack>
    </FormDrawer>
  );
}
