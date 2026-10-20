import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { Package } from 'lucide-react';
import { brand } from '../../../theme/palette';
import CurrencyDisplay from '../../../components/common/CurrencyDisplay';
import StatusChip from '../../../components/common/StatusChip';
import { formatPercent } from '../../../utils/format';
import type { Product } from '../../../modules/products/types/product.types';

export default function ProductCard({
  product,
  onClick,
  soldOut = false,
}: {
  product: Product;
  onClick: () => void;
  /** Ran out at the session's branch: no ingredients left for its recipe. */
  soldOut?: boolean;
}) {
  const margin =
    product.salePrice > 0 ? (product.salePrice - product.currentCost) / product.salePrice : 0;

  return (
    <Card sx={{ height: '100%', opacity: product.isActive ? 1 : 0.6 }}>
      <CardActionArea onClick={onClick} sx={{ height: '100%', alignItems: 'stretch' }}>
        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(brand.gold, 0.12),
              }}
            >
              {product.imageUrl ? (
                <Box
                  component="img"
                  src={product.imageUrl}
                  alt=""
                  loading="lazy"
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <Package size={22} color={brand.gold} />
              )}
            </Box>
            <Stack direction="row" spacing={0.75}>
              {product.menuAvailability !== 'MENU' && (
                <StatusChip
                  label={product.menuAvailability === 'BUILDER' ? 'Solo combo' : 'Menú + combo'}
                  tone="gold"
                />
              )}
              {soldOut && product.isActive && <StatusChip label="Agotado" tone="error" />}
              <StatusChip
                label={product.isActive ? 'Activo' : 'Inactivo'}
                tone={product.isActive ? 'success' : 'neutral'}
              />
            </Stack>
          </Stack>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1.5 }}>
            {product.name}
          </Typography>
          {product.sku && (
            <Typography variant="caption" color="text.secondary">
              Referencia: {product.sku}
            </Typography>
          )}
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 0.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              flex: 1,
            }}
          >
            {product.description ?? 'Sin descripción'}
          </Typography>
          <Stack
            direction="row"
            sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 2 }}
          >
            <CurrencyDisplay
              value={product.salePrice}
              variant="subtitle1"
              sx={{ fontWeight: 700 }}
            />
            <Typography
              variant="caption"
              color={margin >= 0.6 ? 'success.main' : margin >= 0.4 ? 'warning.main' : 'error.main'}
              sx={{ fontWeight: 700 }}
            >
              Margen {formatPercent(margin)}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
