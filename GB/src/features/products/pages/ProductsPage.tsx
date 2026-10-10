import { useMemo, useState } from 'react';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Stack from '@mui/material/Stack';
import { Plus, QrCode } from 'lucide-react';
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
import { useCurrentBusiness } from '../../../modules/businesses/hooks/use-current-business';
import { useProductRecipe } from '../../../modules/recipes/hooks/use-product-recipe';
import { useCreateRecipe } from '../../../modules/recipes/hooks/use-create-recipe';
import { useSetRecipeItems } from '../../../modules/recipes/hooks/use-set-recipe-items';
import { useDeleteRecipe } from '../../../modules/recipes/hooks/use-delete-recipe';
import { normalizeApiError } from '../../../lib/api/api-error';
import ProductCard from '../components/ProductCard';
import ProductDetailDrawer from '../components/ProductDetailDrawer';
import ProductFormDrawer from '../components/ProductFormDrawer';
import ProductRecipeDialog from '../components/ProductRecipeDialog';
import ProductCategoriesTab from '../components/ProductCategoriesTab';
import PublicMenuLinkDialog from '../components/PublicMenuLinkDialog';
import SaucesTab from '../components/SaucesTab';
import SidesTab from '../components/SidesTab';
import type { Product } from '../../../modules/products/types/product.types';
import type { ProductFormValues } from '../schemas/productSchema';

type TabKey = 'productos' | 'categorias' | 'salsas' | 'acompanantes';

export default function ProductsPage() {
  const { enqueueSnackbar } = useSnackbar();

  const [tab, setTab] = useState<TabKey>('productos');
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState<'todos' | 'disponible' | 'no_disponible'>(
    'todos',
  );
  const [categoryId, setCategoryId] = useState<string>('todas');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [recipeProduct, setRecipeProduct] = useState<Product | null>(null);
  const [menuLinkOpen, setMenuLinkOpen] = useState(false);

  const { data: currentBusiness } = useCurrentBusiness();

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
  const { data: categoriesData } = useProductCategories({ limit: 100, isActive: true });
  const categories = categoriesData?.data ?? [];
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
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
      const items = [{ inventoryItemId: values.inventoryItemId, quantity: values.inventoryQuantity || 1 }];
      if (hadRecipe) {
        setRecipeItems.mutate({ productId, items }, { onError });
      } else {
        createRecipe.mutate({ productId, payload: { items } }, { onError });
      }
    } else if (hadRecipe) {
      deleteRecipe.mutate(productId, { onError });
    }
  };

  const handleSubmit = (values: ProductFormValues) => {
    const payload = {
      name: values.name,
      categoryId: values.categoryId || undefined,
      description: values.description || undefined,
      sku: values.sku || undefined,
      salePrice: values.salePrice,
      trackInventory: values.trackInventory,
      maxSauces: values.maxSauces,
      maxSides: values.maxSides,
    };

    if (editingProduct) {
      const hadRecipe = Boolean(editingRecipe);
      updateProduct.mutate(
        { id: editingProduct.id, payload },
        {
          onSuccess: () => {
            enqueueSnackbar('Producto actualizado correctamente', { variant: 'success' });
            syncInventoryLink(editingProduct.id, values, hadRecipe);
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
            updated.isVisible ? 'Producto visible en el menú público' : 'Producto oculto del menú público',
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
        subtitle="Gestiona el catálogo de productos del menú, sus categorías, salsas y acompañantes."
        breadcrumbs={[{ label: 'Productos' }]}
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<QrCode size={16} />}
              onClick={() => setMenuLinkOpen(true)}
            >
              Compartir menú
            </Button>
            {tab === 'productos' && (
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
            )}
          </Stack>
        }
      />

      <Tabs value={tab} onChange={(_, value: TabKey) => setTab(value)} sx={{ mb: 2 }}>
        <Tab value="productos" label="Productos" />
        <Tab value="categorias" label="Categorías" />
        <Tab value="salsas" label="Salsas" />
        <Tab value="acompanantes" label="Acompañantes" />
      </Tabs>

      {tab === 'categorias' && <ProductCategoriesTab />}
      {tab === 'salsas' && <SaucesTab />}
      {tab === 'acompanantes' && <SidesTab />}

      {tab === 'productos' && (
        <>
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
          actionLabel="Nuevo producto"
          onAction={() => {
            setEditingProduct(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <Grid container spacing={2}>
          {products.map((product) => (
            <Grid key={product.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <ProductCard product={product} onClick={() => setSelectedProduct(product)} />
            </Grid>
          ))}
        </Grid>
      )}
        </>
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

      <PublicMenuLinkDialog
        open={menuLinkOpen}
        businessId={currentBusiness?.id}
        businessName={currentBusiness?.name}
        onClose={() => setMenuLinkOpen(false)}
      />
    </>
  );
}
