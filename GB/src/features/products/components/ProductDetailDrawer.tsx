import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import { Pencil, Trash2, Power, Boxes, Eye, EyeOff } from 'lucide-react';
import DetailDrawer from '../../../components/common/DetailDrawer';
import CurrencyDisplay from '../../../components/common/CurrencyDisplay';
import StatusChip from '../../../components/common/StatusChip';
import { formatPercent } from '../../../utils/format';
import { Can } from '../../../modules/auth/components/can';
import { useProductRecipe } from '../../../modules/recipes/hooks/use-product-recipe';
import type { Product } from '../../../modules/products/types/product.types';
import ProductBranchSection from './ProductBranchSection';

interface ProductDetailDrawerProps {
  product: Product | null;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onToggleStatus: (product: Product) => void;
  onToggleVisibility: (product: Product) => void;
  onManageRecipe: (product: Product) => void;
}

export default function ProductDetailDrawer({
  product,
  onClose,
  onEdit,
  onDelete,
  onToggleStatus,
  onToggleVisibility,
  onManageRecipe,
}: ProductDetailDrawerProps) {
  const { data: recipe, isLoading: recipeLoading } = useProductRecipe(product?.id ?? null);

  if (!product) return null;

  const margin =
    product.salePrice > 0 ? (product.salePrice - product.currentCost) / product.salePrice : 0;

  return (
    <DetailDrawer
      open={Boolean(product)}
      onClose={onClose}
      title={product.name}
      subtitle={product.sku ? `Referencia: ${product.sku}` : undefined}
      footer={
        <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
          <Can permission="products.update">
            <Button
              startIcon={product.isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              onClick={() => onToggleVisibility(product)}
            >
              {product.isVisible ? 'Ocultar del menú' : 'Mostrar en menú'}
            </Button>
            <Button startIcon={<Power size={16} />} onClick={() => onToggleStatus(product)}>
              {product.isActive ? 'Desactivar' : 'Activar'}
            </Button>
            <Button
              color="error"
              startIcon={<Trash2 size={16} />}
              onClick={() => onDelete(product)}
            >
              Eliminar
            </Button>
            <Button
              variant="contained"
              startIcon={<Pencil size={16} />}
              onClick={() => onEdit(product)}
            >
              Editar producto
            </Button>
          </Can>
        </Stack>
      }
    >
      <Stack spacing={3}>
        <Typography variant="body2" color="text.secondary">
          {product.description ?? 'Sin descripción'}
        </Typography>

        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Precio de venta
            </Typography>
            <CurrencyDisplay value={product.salePrice} variant="h6" sx={{ fontWeight: 700 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Costo actual
            </Typography>
            <CurrencyDisplay value={product.currentCost} variant="h6" sx={{ fontWeight: 700 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Margen
            </Typography>
            <Typography
              variant="h6"
              color={margin >= 0.6 ? 'success.main' : margin >= 0.4 ? 'warning.main' : 'error.main'}
              sx={{ fontWeight: 700 }}
            >
              {formatPercent(margin)}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1}>
          <StatusChip
            label={product.isActive ? 'Activo' : 'Inactivo'}
            tone={product.isActive ? 'success' : 'neutral'}
          />
          <StatusChip
            label={product.isVisible ? 'Visible en menú público' : 'Oculto del menú público'}
            tone={product.isVisible ? 'gold' : 'neutral'}
          />
          <StatusChip
            label={product.trackInventory ? 'Controla inventario' : 'No controla inventario'}
            tone={product.trackInventory ? 'gold' : 'neutral'}
          />
        </Stack>

        {product.trackInventory && (
          <>
            <Divider />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Vínculo con inventario
              </Typography>
              {recipeLoading ? (
                <Typography variant="body2" color="text.secondary">
                  Cargando...
                </Typography>
              ) : recipe && recipe.items.length > 0 ? (
                <Stack spacing={0.5}>
                  {recipe.items.map((item) => (
                    <Typography key={item.id} variant="body2">
                      {item.quantity} × {item.inventoryItemName} ({item.unit})
                    </Typography>
                  ))}
                </Stack>
              ) : (
                <Alert severity="warning" sx={{ mb: 1 }}>
                  Este producto no está vinculado a ningún artículo de inventario — al venderlo no
                  se descontará stock.
                </Alert>
              )}
              <Can permission="products.update">
                <Button
                  size="small"
                  startIcon={<Boxes size={15} />}
                  onClick={() => onManageRecipe(product)}
                  sx={{ mt: 1 }}
                >
                  {recipe && recipe.items.length > 0 ? 'Editar vínculo' : 'Vincular inventario'}
                </Button>
              </Can>
            </Box>
          </>
        )}

        <ProductBranchSection product={product} />
      </Stack>
    </DetailDrawer>
  );
}
