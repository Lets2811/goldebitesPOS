import { useMemo, useState } from 'react';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { MODULE_PATHS } from '../../../routes/navConfig';
import { useSnackbar } from 'notistack';
import PageHeader from '../../../components/common/PageHeader';
import FilterBar from '../../../components/common/FilterBar';
import SearchInput from '../../../components/common/SearchInput';
import EmptyState from '../../../components/common/EmptyState';
import ErrorState from '../../../components/common/ErrorState';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { Can } from '../../../modules/auth/components/can';
import { useProducts } from '../../../modules/products/hooks/use-products';
import { useCreateProduct } from '../../../modules/products/hooks/use-create-product';
import { useUpdateProduct } from '../../../modules/products/hooks/use-update-product';
import { useDeleteProduct } from '../../../modules/products/hooks/use-delete-product';
import { useSetProductStatus } from '../../../modules/products/hooks/use-set-product-status';
import { useSetProductVisibility } from '../../../modules/products/hooks/use-set-product-visibility';
import { useProductCategories } from '../../../modules/product-categories/hooks/use-product-categories';
import { useProductRecipe } from '../../../modules/recipes/hooks/use-product-recipe';
import { useCreateRecipe } from '../../../modules/recipes/hooks/use-create-recipe';
import { useSetRecipeItems } from '../../../modules/recipes/hooks/use-set-recipe-items';
import { useDeleteRecipe } from '../../../modules/recipes/hooks/use-delete-recipe';
import { normalizeApiError } from '../../../lib/api/api-error';
import ProductCard from '../components/ProductCard';
import ProductDetailDrawer from '../components/ProductDetailDrawer';
import {
  useRemoveProductImage,
  useUploadProductImage,
} from '../../../modules/products/hooks/use-product-image';
import type { ProductImageChange } from '../components/ProductImageField';
import ProductFormDrawer from '../components/ProductFormDrawer';
import ProductRecipeDialog from '../components/ProductRecipeDialog';
import type { Product } from '../../../modules/products/types/product.types';
import { useBranchMenu } from '../../../modules/products/branch-menu';
import type { ProductFormValues } from '../schemas/productSchema';
import { useAllBranchesReview } from '../../../modules/auth/hooks/use-branch-mode';
import { useBranchNames } from '../../../modules/branches/hooks/use-branch-names';

export default function ProductsPage() {
  const { enqueueSnackbar } = useSnackbar();

  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState<'todos' | 'disponible' | 'no_disponible'>(
    'todos',
  );
  const [categoryId, setCategoryId] = useState<string>('todas');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(() => searchParams.get('nuevo') === '1');
  if (searchParams.get('nuevo') === '1') {
    // Se consume una vez: recargar o volver atrás no lo reabre.
    setSearchParams({}, { replace: true });
  }
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [recipeProduct, setRecipeProduct] = useState<Product | null>(null);

  const filters = useMemo(
    () => ({
      limit: 100,
      search: search || undefined,
      isActive: availability === 'todos' ? undefined : availability === 'disponible',
      categoryId: categoryId === 'todas' ? undefined : categoryId,
    }),
    [search, availability, categoryId],
  );

  const { data, isLoading, isError, refetch } = useProducts(filters);
  const { data: branchMenu } = useBranchMenu();
  // In "Todas las sedes" every branch's catalog shows, each product saying whose it is;
  // a product is created at its branch.
  const reviewOnly = useAllBranchesReview();
  const branchNames = useBranchNames();
  const soldOut = useMemo(
    () => new Set((branchMenu ?? []).filter((p) => p.outOfStock).map((p) => p.id)),
    [branchMenu],
  );
  const { data: categoriesData } = useProductCategories({ limit: 100, isActive: true });
  const categories = categoriesData?.data ?? [];
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const uploadImage = useUploadProductImage();
  const removeImage = useRemoveProductImage();
  const setProductStatus = useSetProductStatus();
  const setProductVisibility = useSetProductVisibility();
  const { data: editingRecipe } = useProductRecipe(editingProduct?.id ?? null);
  const createRecipe = useCreateRecipe();
  const setRecipeItems = useSetRecipeItems();
  const deleteRecipe = useDeleteRecipe();

  const products = data?.data ?? [];

  /**
   * Syncs the simple 1-item inventory link from the product form. Recipes with
   * more than 1 item are managed only via ProductRecipeDialog (the form hides
   * those fields in that case), so this never touches a multi-item recipe.
   */
  const syncInventoryLink = (productId: string, values: ProductFormValues, hadRecipe: boolean) => {
    if (hadRecipe && (editingRecipe?.items.length ?? 0) > 1) return;

    const onError = (error: unknown) =>
      enqueueSnackbar(
        `Producto guardado, pero no se pudo actualizar el vínculo con inventario: ${normalizeApiError(error).message}`,
        { variant: 'warning' },
      );

    if (values.inventoryItemId) {
      const items = [
        { inventoryItemId: values.inventoryItemId, quantity: values.inventoryQuantity || 1 },
      ];
      if (hadRecipe) {
        setRecipeItems.mutate({ productId, items }, { onError });
      } else {
        createRecipe.mutate({ productId, payload: { items } }, { onError });
      }
    } else if (hadRecipe) {
      deleteRecipe.mutate(productId, { onError });
    }
  };

  /** After the product itself is saved: upload the new photo, or remove the old one. */
  const applyImageChange = (productId: string, change: ProductImageChange) => {
    const onError = (error: unknown) =>
      enqueueSnackbar(
        `Producto guardado, pero no se pudo guardar la foto: ${normalizeApiError(error).message}`,
        {
          variant: 'warning',
        },
      );
    if (change.kind === 'set') {
      uploadImage.mutate(
        { id: productId, file: change.file },
        { onError, onSettled: () => URL.revokeObjectURL(change.previewUrl) },
      );
    } else if (change.kind === 'remove') {
      removeImage.mutate(productId, { onError });
    }
  };

  const handleSubmit = (values: ProductFormValues, imageChange: ProductImageChange) => {
    const payload = {
      name: values.name,
      categoryId: values.categoryId || undefined,
      description: values.description || undefined,
      sku: values.sku || undefined,
      salePrice: values.salePrice,
      trackInventory: values.trackInventory,
      optionGroups: values.optionGroups,
      menuAvailability: values.menuAvailability,
    };

    if (editingProduct) {
      const hadRecipe = Boolean(editingRecipe);
      updateProduct.mutate(
        { id: editingProduct.id, payload },
        {
          onSuccess: () => {
            enqueueSnackbar('Producto actualizado correctamente', { variant: 'success' });
            syncInventoryLink(editingProduct.id, values, hadRecipe);
            applyImageChange(editingProduct.id, imageChange);
            setFormOpen(false);
          },
          onError: (error) => {
            enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' });
          },
        },
      );
    } else {
      createProduct.mutate(payload, {
        onSuccess: (created) => {
          enqueueSnackbar('Producto creado correctamente', { variant: 'success' });
          syncInventoryLink(created.id, values, false);
          applyImageChange(created.id, imageChange);
          setFormOpen(false);
        },
        onError: (error) => {
          enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' });
        },
      });
    }
  };

  const handleDelete = () => {
    if (!deletingProduct) return;
    deleteProduct.mutate(deletingProduct.id, {
      onSuccess: () => enqueueSnackbar('Producto eliminado', { variant: 'success' }),
      onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      onSettled: () => setDeletingProduct(null),
    });
  };

  const handleToggleStatus = (product: Product) => {
    setProductStatus.mutate(
      { id: product.id, isActive: !product.isActive },
      {
        onSuccess: (updated) => {
          enqueueSnackbar(updated.isActive ? 'Producto activado' : 'Producto desactivado', {
            variant: 'success',
          });
          setSelectedProduct(updated);
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );
  };

  const handleToggleVisibility = (product: Product) => {
    setProductVisibility.mutate(
      { id: product.id, isVisible: !product.isVisible },
      {
        onSuccess: (updated) => {
          enqueueSnackbar(
            updated.isVisible
              ? 'Producto visible en el menú público'
              : 'Producto oculto del menú público',
            { variant: 'success' },
          );
          setSelectedProduct(updated);
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Productos"
        subtitle="El catálogo del menú: precio, receta, opciones para elegir y dónde lo ve el cliente."
        backTo={{ label: 'Productos y recetas', path: MODULE_PATHS.products }}
        actions={
          !reviewOnly && (
            <Can permission="products.create">
              <Button
                variant="contained"
                startIcon={<Plus size={16} />}
                onClick={() => {
                  setEditingProduct(null);
                  setFormOpen(true);
                }}
              >
                Nuevo producto
              </Button>
            </Can>
          )
        }
      />

      <FilterBar
        onClear={() => {
          setSearch('');
          setAvailability('todos');
          setCategoryId('todas');
        }}
        hasActiveFilters={Boolean(search) || availability !== 'todos' || categoryId !== 'todas'}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar producto..." />
        <TextField
          select
          size="small"
          label="Categoría"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="todas">Todas</MenuItem>
          {categories.map((category) => (
            <MenuItem key={category.id} value={category.id}>
              {category.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Estado"
          value={availability}
          onChange={(e) => setAvailability(e.target.value as typeof availability)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="todos">Todos</MenuItem>
          <MenuItem value="disponible">Activos</MenuItem>
          <MenuItem value="no_disponible">Inactivos</MenuItem>
        </TextField>
      </FilterBar>

      {isLoading ? (
        <LoadingSkeleton variant="cards" rows={8} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : products.length === 0 ? (
        <EmptyState
          title="No hay productos con estos filtros"
          description="Ajusta la búsqueda o crea un nuevo producto para tu menú."
          actionLabel={reviewOnly ? undefined : 'Nuevo producto'}
          onAction={() => {
            setEditingProduct(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <Grid container spacing={2}>
          {products.map((product) => (
            <Grid key={product.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <ProductCard
                product={product}
                soldOut={soldOut.has(product.id)}
                branchName={reviewOnly ? branchNames.get(product.branchId) : undefined}
                onClick={() => setSelectedProduct(product)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <ProductDetailDrawer
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onEdit={(p) => {
          setSelectedProduct(null);
          setEditingProduct(p);
          setFormOpen(true);
        }}
        onDelete={(p) => {
          setSelectedProduct(null);
          setDeletingProduct(p);
        }}
        onToggleStatus={handleToggleStatus}
        onToggleVisibility={handleToggleVisibility}
        onManageRecipe={(p) => {
          setSelectedProduct(null);
          setRecipeProduct(p);
        }}
      />

      <ProductRecipeDialog product={recipeProduct} onClose={() => setRecipeProduct(null)} />

      <ProductFormDrawer
        open={formOpen}
        initialProduct={editingProduct}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deletingProduct)}
        title="Eliminar producto"
        description={`¿Seguro que deseas eliminar "${deletingProduct?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onClose={() => setDeletingProduct(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}
