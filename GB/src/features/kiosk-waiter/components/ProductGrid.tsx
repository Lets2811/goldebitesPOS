import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { UtensilsCrossed } from 'lucide-react';
import { useMemo } from 'react';
import Chip from '@mui/material/Chip';
import { useBranchMenu } from '../../../modules/products/branch-menu';
import { formatCOP } from '../../../utils/format';
import type { Product } from '../../../modules/products/types/product.types';

interface ProductGridProps {
  categoryId: string | null;
  onSelect: (product: Product) => void;
}

/**
 * The branch's menu, at its prices. What it ran out of (no ingredients left
 * for its recipe) shows as sold out and can't be picked.
 */
export default function ProductGrid({ categoryId, onSelect }: ProductGridProps) {
  const { data, isLoading } = useBranchMenu();
  const products = useMemo(
    () => (data ?? []).filter((product) => !categoryId || product.categoryId === categoryId),
    [data, categoryId],
  );

  if (!isLoading && products.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No hay productos en esta categoría.</Typography>
      </Box>
    );
  }

  return (
    <Stack>
      {products.map((product) => (
        <ButtonBase
          key={product.id}
          onClick={() => onSelect(product)}
          disabled={product.outOfStock}
          sx={{
            '&.Mui-disabled': { opacity: 0.45 },
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            textAlign: 'left',
            justifyContent: 'flex-start',
            '&:active': { bgcolor: 'action.selected' },
          }}
        >
          <Box
            sx={{
              width: 60,
              height: 60,
              flexShrink: 0,
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {product.imageUrl ? (
              <Box
                component="img"
                src={product.imageUrl}
                alt={product.name}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <UtensilsCrossed size={26} strokeWidth={1.5} />
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body1"
              sx={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.3 }}
            >
              {product.name}
            </Typography>
            {product.outOfStock && (
              <Chip
                label="Agotado"
                size="small"
                color="error"
                variant="outlined"
                sx={{ mt: 0.5, height: 20 }}
              />
            )}
          </Box>
          <Typography
            variant="body1"
            color="primary.main"
            sx={{ fontWeight: 800, flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {formatCOP(product.salePrice)}
          </Typography>
        </ButtonBase>
      ))}
    </Stack>
  );
}
