import { useState } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { Ban, ShoppingCart, UtensilsCrossed, X } from 'lucide-react';
import { formatCOP } from '../../../utils/format';
import { brand } from '../../../theme/palette';
import type { PublicMenuOption, PublicMenuProduct } from '../../../modules/public-menu/types/public-menu.types';
import type { CartSelection } from '../hooks/use-public-cart';

interface ProductDetailDialogProps {
  product: PublicMenuProduct | null;
  sauces: PublicMenuOption[];
  sides: PublicMenuOption[];
  onAdd: (product: PublicMenuProduct, selection: CartSelection) => void;
  onClose: () => void;
  /** Solo muestra el producto: sin personalización ni "Agregar al carrito" (mesa sin autoservicio). */
  readOnly?: boolean;
}

/** Configures and adds one unit of a product to the cart. Each open/add cycle produces exactly one line — adding a second, differently-configured unit means reopening this dialog. */
export default function ProductDetailDialog({ product, sauces, sides, onAdd, onClose, readOnly }: ProductDetailDialogProps) {
  return (
    <Dialog open={Boolean(product)} onClose={onClose} maxWidth="sm" fullWidth>
      {/* Keyed by product id so selection state starts fresh for each product, without an effect. */}
      {product && (
        <ProductDetailContent
          key={product.id}
          product={product}
          sauces={sauces}
          sides={sides}
          onAdd={onAdd}
          onClose={onClose}
          readOnly={readOnly}
        />
      )}
    </Dialog>
  );
}

interface ProductDetailContentProps {
  product: PublicMenuProduct;
  sauces: PublicMenuOption[];
  sides: PublicMenuOption[];
  onAdd: (product: PublicMenuProduct, selection: CartSelection) => void;
  onClose: () => void;
  readOnly?: boolean;
}

function ProductDetailContent({ product, sauces, sides, onAdd, onClose, readOnly }: ProductDetailContentProps) {
  const [selectedSauceIds, setSelectedSauceIds] = useState<string[]>([]);
  const [selectedSideIds, setSelectedSideIds] = useState<string[]>([]);
  const [noSauces, setNoSauces] = useState(false);
  const [noSides, setNoSides] = useState(false);

  const toggleSauce = (sauceId: string) => {
    setNoSauces(false);
    setSelectedSauceIds((current) => {
      if (current.includes(sauceId)) return current.filter((id) => id !== sauceId);
      if (current.length >= product.maxSauces) return current;
      return [...current, sauceId];
    });
  };

  const toggleSide = (sideId: string) => {
    setNoSides(false);
    setSelectedSideIds((current) => {
      if (current.includes(sideId)) return current.filter((id) => id !== sideId);
      if (current.length >= product.maxSides) return current;
      return [...current, sideId];
    });
  };

  // "Sin..." excludes any real selection — it's a visual cart choice, never a catalog id.
  const chooseNoSauces = () => {
    setSelectedSauceIds([]);
    setNoSauces((current) => !current);
  };
  const chooseNoSides = () => {
    setSelectedSideIds([]);
    setNoSides((current) => !current);
  };

  const sauceDecided = product.maxSauces === 0 || selectedSauceIds.length > 0 || noSauces;
  const sideDecided = product.maxSides === 0 || selectedSideIds.length > 0 || noSides;
  const canAdd = sauceDecided && sideDecided;
  const hasCustomization = !readOnly && (product.maxSauces > 0 || product.maxSides > 0);

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(product, { sauceIds: selectedSauceIds, sideIds: selectedSideIds, noSauces, noSides });
    onClose();
  };

  const selectedSauceNames = noSauces ? ['Sin salsas'] : sauces.filter((s) => selectedSauceIds.includes(s.id)).map((s) => s.name);
  const selectedSideNames = noSides ? ['Sin acompañamiento'] : sides.filter((s) => selectedSideIds.includes(s.id)).map((s) => s.name);

  return (
    <>
      <Box
        sx={{
          position: 'relative',
          height: 200,
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
          <UtensilsCrossed size={48} color={brand.gold} strokeWidth={1.5} />
        )}
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            bgcolor: 'background.paper',
            '&:hover': { bgcolor: 'background.paper' },
          }}
        >
          <X size={18} />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: 2.5 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {product.name}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
            {formatCOP(product.salePrice)}
          </Typography>
        </Stack>
        {product.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {product.description}
          </Typography>
        )}

        {hasCustomization && (
          <>
            <Divider sx={{ my: 2.5 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              Personaliza tu unidad
            </Typography>

            {product.maxSauces > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Salsas (máx. {product.maxSauces}) — elige o marca "Sin salsas"
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                  <Chip
                    icon={<Ban size={14} />}
                    label="Sin salsas"
                    clickable
                    onClick={chooseNoSauces}
                    color={noSauces ? 'secondary' : 'default'}
                    variant={noSauces ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 600, fontStyle: 'italic' }}
                  />
                  {sauces.map((sauce) => {
                    const selected = selectedSauceIds.includes(sauce.id);
                    const disabled = !selected && selectedSauceIds.length >= product.maxSauces;
                    return (
                      <Chip
                        key={sauce.id}
                        label={sauce.name}
                        clickable={!disabled}
                        disabled={disabled}
                        onClick={() => toggleSauce(sauce.id)}
                        color={selected ? 'primary' : 'default'}
                        variant={selected ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 600 }}
                      />
                    );
                  })}
                </Stack>
              </Box>
            )}

            {product.maxSides > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Acompañantes (máx. {product.maxSides}) — elige o marca "Sin acompañamiento"
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                  <Chip
                    icon={<Ban size={14} />}
                    label="Sin acompañamiento"
                    clickable
                    onClick={chooseNoSides}
                    color={noSides ? 'secondary' : 'default'}
                    variant={noSides ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 600, fontStyle: 'italic' }}
                  />
                  {sides.map((side) => {
                    const selected = selectedSideIds.includes(side.id);
                    const disabled = !selected && selectedSideIds.length >= product.maxSides;
                    return (
                      <Chip
                        key={side.id}
                        label={side.name}
                        clickable={!disabled}
                        disabled={disabled}
                        onClick={() => toggleSide(side.id)}
                        color={selected ? 'primary' : 'default'}
                        variant={selected ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 600 }}
                      />
                    );
                  })}
                </Stack>
              </Box>
            )}

            {(selectedSauceNames.length > 0 || selectedSideNames.length > 0) && (
              <Typography variant="body2" sx={{ mt: 1.5, fontStyle: 'italic' }}>
                Tu selección: {[...selectedSauceNames, ...selectedSideNames].join(', ')}
              </Typography>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ fontWeight: 700 }}>
          {readOnly ? 'Cerrar' : 'Cancelar'}
        </Button>
        {!readOnly && (
          <Button
            onClick={handleAdd}
            variant="contained"
            disabled={!canAdd}
            startIcon={<ShoppingCart size={18} />}
            sx={{ fontWeight: 700, flex: 1 }}
          >
            Agregar al carrito
          </Button>
        )}
      </DialogActions>
    </>
  );
}
