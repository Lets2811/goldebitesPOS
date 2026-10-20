import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { Plus, Sparkles, X } from 'lucide-react';
import { formatCOP } from '../../../utils/format';
import { brand } from '../../../theme/palette';
import type {
  PublicMenuCategory,
  PublicMenuOptionGroup,
  PublicMenuProduct,
} from '../../../modules/public-menu/types/public-menu.types';
import { describeSelection, type CartSelection } from '../hooks/use-public-cart';
import ProductDetailDialog from './ProductDetailDialog';

/** Un producto elegido para el combo, con lo que el cliente le eligió. */
interface ComboUnit {
  key: number;
  product: PublicMenuProduct;
  selection: CartSelection;
}

/** Desde cuántos productos es un combo: uno solo se pide desde el menú normal. */
export const MIN_COMBO_ITEMS = 2;

interface ComboBuilderDialogProps {
  /** What the business calls it ("Arma tu combo" by default). */
  title: string;
  open: boolean;
  categories: PublicMenuCategory[];
  optionGroups: PublicMenuOptionGroup[];
  onClose: () => void;
  onAddCombo: (units: { product: PublicMenuProduct; selection: CartSelection }[]) => void;
}

/**
 * "Arma tu combo": el cliente junta los productos que quiera de los que el
 * negocio ofrece para armar, cada uno con lo que quiera elegirle, y los
 * agrega al pedido como un solo combo. Cuesta la suma de lo elegido.
 */
export default function ComboBuilderDialog({
  title,
  open,
  categories,
  optionGroups,
  onClose,
  onAddCombo,
}: ComboBuilderDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [units, setUnits] = useState<ComboUnit[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [picking, setPicking] = useState<PublicMenuProduct | null>(null);
  const [wasOpen, setWasOpen] = useState(open);

  // Cada vez que se abre, el combo empieza vacío.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setUnits([]);
  }

  const total = units.reduce((sum, unit) => sum + unit.product.salePrice, 0);
  const ready = units.length >= MIN_COMBO_ITEMS;

  const add = (product: PublicMenuProduct, selection: CartSelection) => {
    setUnits((current) => [...current, { key: nextKey, product, selection }]);
    setNextKey((key) => key + 1);
  };

  const describe = (unit: ComboUnit) => describeSelection(unit.selection, optionGroups).join(' · ');

  return (
    <>
      <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth>
        <Stack sx={{ height: fullScreen ? '100%' : '80vh' }}>
          <Stack direction="row" sx={{ alignItems: 'center', px: 2.5, py: 2, gap: 1.5 }}>
            <Sparkles size={22} color={brand.gold} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Elige lo que quieras: pagas la suma de lo que escojas.
              </Typography>
            </Box>
            <IconButton onClick={onClose} aria-label="Cerrar">
              <X size={20} />
            </IconButton>
          </Stack>
          <Divider />

          <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>
            <Stack spacing={3.5}>
              {categories.map((category) => (
                <Box key={category.id ?? 'uncategorized'}>
                  <Typography variant="overline" sx={{ color: brand.gold, fontWeight: 700, letterSpacing: 1.5 }}>
                    {category.name}
                  </Typography>
                  <Divider sx={{ mb: 1, mt: 0.5, borderColor: brand.gold, opacity: 0.3 }} />
                  <Stack spacing={0.5}>
                    {category.products.map((product) => {
                      const chosen = units.filter((unit) => unit.product.id === product.id).length;
                      return (
                        <ButtonBase
                          key={product.id}
                          onClick={() => setPicking(product)}
                          sx={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            py: 1,
                            px: 1,
                            borderRadius: 1.5,
                            textAlign: 'left',
                            justifyContent: 'flex-start',
                            border: '1px solid',
                            borderColor: chosen > 0 ? brand.gold : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {product.name}
                              {chosen > 0 ? ` ×${chosen}` : ''}
                            </Typography>
                            {product.description && (
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                {product.description}
                              </Typography>
                            )}
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {formatCOP(product.salePrice)}
                          </Typography>
                          <Plus size={18} color={brand.gold} />
                        </ButtonBase>
                      );
                    })}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>

          <Divider />
          <Box sx={{ px: 2.5, py: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Tu combo
            </Typography>
            {units.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Toca los productos de arriba para agregarlos.
              </Typography>
            ) : (
              <Stack spacing={0.5} sx={{ mb: 1.5, maxHeight: 140, overflowY: 'auto' }}>
                {units.map((unit) => (
                  <Stack key={unit.key} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {unit.product.name}
                      </Typography>
                      {describe(unit) && (
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {describe(unit)}
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="body2">{formatCOP(unit.product.salePrice)}</Typography>
                    <IconButton
                      size="small"
                      aria-label={`Quitar ${unit.product.name}`}
                      onClick={() => setUnits((current) => current.filter((u) => u.key !== unit.key))}
                    >
                      <X size={14} />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}
            <Button
              variant="contained"
              size="large"
              fullWidth
              disabled={!ready}
              onClick={() => {
                onAddCombo(units.map(({ product, selection }) => ({ product, selection })));
                onClose();
              }}
              sx={{ fontWeight: 800 }}
            >
              {ready
                ? `Agregar combo · ${formatCOP(total)}`
                : `Elige al menos ${MIN_COMBO_ITEMS} productos (${units.length}/${MIN_COMBO_ITEMS})`}
            </Button>
          </Box>
        </Stack>
      </Dialog>

      <ProductDetailDialog
        product={picking}
        optionGroups={optionGroups}
        onAdd={add}
        onClose={() => setPicking(null)}
        addLabel="Agregar al combo"
      />
    </>
  );
}
