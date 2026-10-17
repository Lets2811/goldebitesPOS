import {
  PRODUCT_MENU_AVAILABILITY_LABELS,
  type ProductMenuAvailability,
} from '../../../modules/products/types/product.types';
import { useEffect, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import FormDrawer from '../../../components/common/FormDrawer';
import CurrencyField from '../../../components/common/CurrencyField';
import { productSchema, type ProductFormValues } from '../schemas/productSchema';
import { useProductCategories } from '../../../modules/product-categories/hooks/use-product-categories';
import { useInventoryItems } from '../../../modules/inventory/hooks/use-inventory-items';
import { useProductRecipe } from '../../../modules/recipes/hooks/use-product-recipe';
import type { Product } from '../../../modules/products/types/product.types';
import ProductOptionGroupsField from './ProductOptionGroupsField';
import ProductImageField, { type ProductImageChange } from './ProductImageField';

interface ProductFormDrawerProps {
  open: boolean;
  onClose: () => void;
  /** imageChange: what to do with the photo once the product is saved. */
  onSubmit: (values: ProductFormValues, imageChange: ProductImageChange) => void;
  initialProduct?: Product | null;
}

const emptyValues: ProductFormValues = {
  name: '',
  categoryId: '',
  description: '',
  sku: '',
  salePrice: 0,
  trackInventory: true,
  inventoryItemId: '',
  inventoryQuantity: 1,
  optionGroups: [],
  menuAvailability: 'MENU',
};

export default function ProductFormDrawer({
  open,
  onClose,
  onSubmit,
  initialProduct,
}: ProductFormDrawerProps) {
  const { data: categoriesData } = useProductCategories({ limit: 100, isActive: true });
  const categories = categoriesData?.data ?? [];
  const { data: inventoryItemsData } = useInventoryItems({ limit: 100, isActive: true });
  const inventoryItems = inventoryItemsData?.data ?? [];
  const { data: recipe, isLoading: recipeLoading } = useProductRecipe(initialProduct?.id ?? null);
  const recipeItemCount = recipe?.items.length ?? 0;
  const [imageChange, setImageChange] = useState<ProductImageChange>({ kind: 'keep' });
  // Each opening starts from the product's current photo.
  const [trackedOpen, setTrackedOpen] = useState({ open, initialProduct });
  if (trackedOpen.open !== open || trackedOpen.initialProduct !== initialProduct) {
    setTrackedOpen({ open, initialProduct });
    if (open) setImageChange({ kind: 'keep' });
  }

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: emptyValues,
  });

  const trackInventory = useWatch({ control, name: 'trackInventory' });
  const inventoryItemId = useWatch({ control, name: 'inventoryItemId' });

  useEffect(() => {
    if (!open) return;
    if (initialProduct && recipeLoading) return;
    const singleItem = recipeItemCount === 1 ? recipe!.items[0] : null;
    reset(
      initialProduct
        ? {
            name: initialProduct.name,
            categoryId: initialProduct.categoryId ?? '',
            description: initialProduct.description ?? '',
            sku: initialProduct.sku ?? '',
            salePrice: initialProduct.salePrice,
            trackInventory: initialProduct.trackInventory,
            inventoryItemId: singleItem?.inventoryItemId ?? '',
            inventoryQuantity: singleItem?.quantity ?? 1,
            optionGroups: initialProduct.optionGroups,
            menuAvailability: initialProduct.menuAvailability ?? 'MENU',
          }
        : emptyValues,
    );
    // recipeItemCount/recipe are derived from the same query as recipeLoading; re-running on recipe is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialProduct, recipe, recipeLoading, reset]);

  const submit = handleSubmit((values) => {
    onSubmit(values, imageChange);
  });

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={initialProduct ? 'Editar producto' : 'Nuevo producto'}
      subtitle="Nombre, precio y disponibilidad del producto en el menú."
      submitLabel={initialProduct ? 'Guardar cambios' : 'Crear producto'}
      loading={isSubmitting}
      width={480}
    >
      <Stack spacing={2.5}>
        <ProductImageField
          currentUrl={initialProduct?.imageUrl ?? null}
          change={imageChange}
          onChange={setImageChange}
        />

        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Nombre del producto"
              fullWidth
              error={Boolean(errors.name)}
              helperText={errors.name?.message}
            />
          )}
        />

        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Descripción"
              multiline
              minRows={2}
              fullWidth
              error={Boolean(errors.description)}
              helperText={errors.description?.message}
            />
          )}
        />

        <Controller
          name="categoryId"
          control={control}
          render={({ field }) => (
            <TextField {...field} value={field.value ?? ''} label="Categoría" select fullWidth>
              <MenuItem value="">Sin categoría</MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        />

        <Stack direction="row" spacing={2}>
          <Controller
            name="sku"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Referencia"
                fullWidth
                error={Boolean(errors.sku)}
                helperText={errors.sku?.message}
              />
            )}
          />
          <Controller
            name="salePrice"
            control={control}
            render={({ field }) => (
              <CurrencyField
                {...field}
                label="Precio de venta (COP)"
                fullWidth
                error={Boolean(errors.salePrice)}
                helperText={errors.salePrice?.message}
              />
            )}
          />
        </Stack>

        <Controller
          name="trackInventory"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
              }
              label="Controla inventario"
            />
          )}
        />

        {trackInventory && recipeItemCount > 1 && (
          <Alert severity="info">
            Este producto ya tiene una receta con varios artículos de inventario. Para editarla,
            usa "Vincular inventario" desde el detalle del producto — este formulario solo maneja
            un vínculo simple de 1 artículo.
          </Alert>
        )}

        {trackInventory && recipeItemCount <= 1 && (
          <Stack direction="row" spacing={2}>
            <Controller
              name="inventoryItemId"
              control={control}
              render={({ field }) => (
                <TextField {...field} value={field.value ?? ''} label="Artículo de inventario" select fullWidth>
                  <MenuItem value="">Sin vincular</MenuItem>
                  {inventoryItems.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.name} ({item.unit})
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="inventoryQuantity"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Cantidad por venta"
                  type="number"
                  fullWidth
                  disabled={!inventoryItemId}
                  error={Boolean(errors.inventoryQuantity)}
                  helperText={errors.inventoryQuantity?.message}
                  sx={{ maxWidth: 160 }}
                />
              )}
            />
          </Stack>
        )}

        <Controller
          name="optionGroups"
          control={control}
          render={({ field }) => <ProductOptionGroupsField value={field.value} onChange={field.onChange} />}
        />

        <Controller
          name="menuAvailability"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              select
              label="Disponible para el cliente en"
              fullWidth
              helperText={
                field.value === 'BUILDER'
                  ? 'No aparece en el menú de la mesa: solo se ofrece para armar combos.'
                  : field.value === 'BOTH'
                    ? 'Aparece en el menú y también se ofrece para armar combos.'
                    : 'Aparece en el menú de la mesa, como hasta ahora.'
              }
            >
              {(Object.keys(PRODUCT_MENU_AVAILABILITY_LABELS) as ProductMenuAvailability[]).map((value) => (
                <MenuItem key={value} value={value}>
                  {PRODUCT_MENU_AVAILABILITY_LABELS[value]}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      </Stack>
    </FormDrawer>
  );
}
