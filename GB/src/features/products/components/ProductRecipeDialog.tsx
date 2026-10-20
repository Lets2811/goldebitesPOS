import { useId, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import { Plus, Trash2 } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { useInventoryItems } from '../../../modules/inventory/hooks/use-inventory-items';
import { useProductRecipe } from '../../../modules/recipes/hooks/use-product-recipe';
import { useCreateRecipe } from '../../../modules/recipes/hooks/use-create-recipe';
import { useSetRecipeItems } from '../../../modules/recipes/hooks/use-set-recipe-items';
import { useDeleteRecipe } from '../../../modules/recipes/hooks/use-delete-recipe';
import { normalizeApiError } from '../../../lib/api/api-error';
import { formatCOP } from '../../../utils/format';
import type { Product } from '../../../modules/products/types/product.types';

interface Row {
  key: string;
  inventoryItemId: string;
  quantity: string;
}

interface ProductRecipeDialogProps {
  product: Product | null;
  onClose: () => void;
}

function emptyRow(index: number): Row {
  return { key: `row-${index}-${Date.now()}`, inventoryItemId: '', quantity: '1' };
}

export default function ProductRecipeDialog({ product, onClose }: ProductRecipeDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const idPrefix = useId();
  const [rows, setRows] = useState<Row[]>([emptyRow(0)]);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  const { data: recipe, isLoading, hasNoRecipe } = useProductRecipe(product?.id ?? null);
  // The product's branch's items: each branch cooks from its own stock.
  const { data: itemsData } = useInventoryItems({
    limit: 100,
    isActive: true,
    branchId: product?.branchId,
  });
  const inventoryItems = itemsData?.data ?? [];

  const createRecipe = useCreateRecipe();
  const setRecipeItems = useSetRecipeItems();
  const deleteRecipe = useDeleteRecipe();
  const saving = createRecipe.isPending || setRecipeItems.isPending;

  // Re-seed the row list once the recipe for this product loads (derived during
  // render, not an effect) — recipe/hasNoRecipe flip from undefined once the
  // query settles, so this only runs once per product open.
  const seedKey =
    product && (recipe || hasNoRecipe) ? `${product.id}:${recipe?.updatedAt ?? 'none'}` : null;
  if (seedKey && seedKey !== seededFor) {
    setSeededFor(seedKey);
    if (recipe && recipe.items.length > 0) {
      setRows(
        recipe.items.map((item, i) => ({
          key: `existing-${item.id}-${i}`,
          inventoryItemId: item.inventoryItemId,
          quantity: String(item.quantity),
        })),
      );
    } else {
      setRows([emptyRow(0)]);
    }
  }

  if (!product) return null;

  const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));
  const selectedIds = new Set(rows.map((r) => r.inventoryItemId).filter(Boolean));

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const previewCost = rows.reduce((sum, row) => {
    const item = inventoryById.get(row.inventoryItemId);
    const quantity = Number(row.quantity) || 0;
    return item ? sum + item.currentCost * quantity : sum;
  }, 0);

  const handleClose = () => {
    if (saving || deleteRecipe.isPending) return;
    setSeededFor(null);
    onClose();
  };

  const handleSave = () => {
    const items = rows
      .filter((r) => r.inventoryItemId && Number(r.quantity) > 0)
      .map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: Number(r.quantity) }));

    if (items.length === 0) {
      enqueueSnackbar('Agrega al menos un artículo de inventario con cantidad mayor a 0', {
        variant: 'error',
      });
      return;
    }

    const onSuccess = () => {
      enqueueSnackbar('Vínculo con inventario guardado', { variant: 'success' });
      onClose();
    };
    const onError = (error: unknown) =>
      enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' });

    if (recipe) {
      setRecipeItems.mutate({ productId: product.id, items }, { onSuccess, onError });
    } else {
      createRecipe.mutate({ productId: product.id, payload: { items } }, { onSuccess, onError });
    }
  };

  const handleUnlink = () => {
    deleteRecipe.mutate(product.id, {
      onSuccess: () => {
        enqueueSnackbar('Vínculo con inventario eliminado', { variant: 'success' });
        setRows([emptyRow(0)]);
      },
      onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
    });
  };

  return (
    <Dialog open={Boolean(product)} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Vínculo con inventario — {product.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Define qué artículos de inventario (y cuánto de cada uno) se descuentan cada vez que se
            vende 1 unidad de "{product.name}". Para un producto de reventa simple, como una
            gaseosa, agrega el artículo correspondiente con cantidad 1.
          </Typography>

          {!product.trackInventory && (
            <Alert severity="warning">
              Este producto tiene "Controla inventario" desactivado — aunque configures el vínculo
              aquí, las ventas no descontarán stock hasta que lo actives al editar el producto.
            </Alert>
          )}

          {isLoading ? (
            <Typography variant="body2" color="text.secondary">
              Cargando...
            </Typography>
          ) : (
            <>
              <Stack spacing={1.5}>
                {rows.map((row) => (
                  <Stack key={row.key} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <TextField
                      select
                      size="small"
                      label="Artículo de inventario"
                      value={row.inventoryItemId}
                      onChange={(e) => updateRow(row.key, { inventoryItemId: e.target.value })}
                      sx={{ flex: 1 }}
                    >
                      {inventoryItems
                        .filter(
                          (item) => item.id === row.inventoryItemId || !selectedIds.has(item.id),
                        )
                        .map((item) => (
                          <MenuItem key={`${idPrefix}-${item.id}`} value={item.id}>
                            {item.name} ({item.unit})
                          </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                      size="small"
                      label="Cantidad"
                      type="number"
                      value={row.quantity}
                      onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                      slotProps={{ htmlInput: { min: 0.001, step: 'any' } }}
                      sx={{ width: 110 }}
                    />
                    {rows.length > 1 && (
                      <IconButton
                        size="small"
                        onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    )}
                  </Stack>
                ))}
              </Stack>

              <Button
                size="small"
                startIcon={<Plus size={14} />}
                onClick={() => setRows((prev) => [...prev, emptyRow(prev.length)])}
                disabled={inventoryItems.length === 0 || selectedIds.size >= inventoryItems.length}
                sx={{ alignSelf: 'flex-start' }}
              >
                Agregar artículo
              </Button>

              {inventoryItems.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  No hay artículos de inventario activos. Créalos primero en Inventario.
                </Typography>
              )}

              <Typography variant="body2" color="text.secondary">
                Costo estimado por unidad vendida: <strong>{formatCOP(previewCost)}</strong>
              </Typography>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'space-between' }}>
        <Button
          color="error"
          onClick={handleUnlink}
          disabled={hasNoRecipe || saving || deleteRecipe.isPending}
          loading={deleteRecipe.isPending}
        >
          Quitar vínculo
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={handleClose} color="inherit" disabled={saving || deleteRecipe.isPending}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} loading={saving}>
            Guardar vínculo
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
