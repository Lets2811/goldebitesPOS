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
import { noneLabel } from '../../../modules/option-groups/utils/option-group-utils';
import type { PublicMenuOptionGroup, PublicMenuProduct } from '../../../modules/public-menu/types/public-menu.types';
import { describeSelection, type CartSelection } from '../hooks/use-public-cart';

interface ProductDetailDialogProps {
  product: PublicMenuProduct | null;
  /** Los grupos de opciones del negocio ("Salsas", "Tamaño"...), con sus opciones activas. */
  optionGroups: PublicMenuOptionGroup[];
  onAdd: (product: PublicMenuProduct, selection: CartSelection) => void;
  onClose: () => void;
  /** Solo muestra el producto: sin personalización ni "Agregar al carrito" (mesa sin autoservicio). */
  readOnly?: boolean;
  /** Texto del botón de agregar; "Arma tu combo" lo usa para agregar al combo en vez de al carrito. */
  addLabel?: string;
}

/** Configures and adds one unit of a product to the cart. Each open/add cycle produces exactly one line — adding a second, differently-configured unit means reopening this dialog. */
export default function ProductDetailDialog({
  product,
  optionGroups,
  onAdd,
  onClose,
  readOnly,
  addLabel,
}: ProductDetailDialogProps) {
  return (
    <Dialog open={Boolean(product)} onClose={onClose} maxWidth="sm" fullWidth>
      {/* Keyed by product id so selection state starts fresh for each product, without an effect. */}
      {product && (
        <ProductDetailContent
          key={product.id}
          product={product}
          optionGroups={optionGroups}
          onAdd={onAdd}
          onClose={onClose}
          readOnly={readOnly}
          addLabel={addLabel}
        />
      )}
    </Dialog>
  );
}

interface ProductDetailContentProps {
  product: PublicMenuProduct;
  optionGroups: PublicMenuOptionGroup[];
  onAdd: (product: PublicMenuProduct, selection: CartSelection) => void;
  onClose: () => void;
  readOnly?: boolean;
  addLabel?: string;
}

function ProductDetailContent({
  product,
  optionGroups,
  onAdd,
  onClose,
  readOnly,
  addLabel = 'Agregar al carrito',
}: ProductDetailContentProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [noneGroupIds, setNoneGroupIds] = useState<string[]>([]);

  // Los grupos que ofrece este producto, en el orden del negocio.
  const maxByGroup = new Map(product.optionGroups.map((o) => [o.groupId, o.maxChoices]));
  const offered = optionGroups
    .filter((group) => maxByGroup.has(group.id))
    .map((group) => ({ group, max: maxByGroup.get(group.id)! }));

  const pickedIn = (group: PublicMenuOptionGroup) =>
    group.items.filter((item) => selectedIds.includes(item.id)).map((item) => item.id);

  const toggle = (group: PublicMenuOptionGroup, max: number, itemId: string) => {
    setNoneGroupIds((current) => current.filter((id) => id !== group.id));
    setSelectedIds((current) => {
      if (current.includes(itemId)) return current.filter((id) => id !== itemId);
      const inGroup = group.items.filter((item) => current.includes(item.id)).map((item) => item.id);
      if (inGroup.length < max) return [...current, itemId];
      // Con máximo 1, tocar otra la cambia.
      if (max === 1) return [...current.filter((id) => !inGroup.includes(id)), itemId];
      return current;
    });
  };

  // "Sin..." excludes any real selection in its group — it's a visual cart choice, never a catalog id.
  const chooseNone = (group: PublicMenuOptionGroup) => {
    setSelectedIds((current) => current.filter((id) => !group.items.some((item) => item.id === id)));
    setNoneGroupIds((current) =>
      current.includes(group.id) ? current.filter((id) => id !== group.id) : [...current, group.id],
    );
  };

  // Cada grupo se decide eligiendo algo o marcando "Sin ..."; uno obligatorio solo eligiendo.
  const canAdd = offered.every(
    ({ group }) => pickedIn(group).length > 0 || (!group.isRequired && noneGroupIds.includes(group.id)),
  );
  const hasCustomization = !readOnly && offered.length > 0;
  const selection: CartSelection = { optionItemIds: selectedIds, noneGroupIds };
  const summary = describeSelection(
    selection,
    offered.map(({ group }) => group),
  );

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(product, selection);
    onClose();
  };

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

            {offered.map(({ group, max }) => {
              const picked = pickedIn(group);
              const isNone = noneGroupIds.includes(group.id);
              const none = noneLabel(group.name);
              return (
                <Box key={group.id} sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {group.name} (máx. {max}) —{' '}
                    {group.isRequired ? 'elige al menos una opción' : `elige o marca "${none}"`}
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                    {!group.isRequired && (
                      <Chip
                        icon={<Ban size={14} />}
                        label={none}
                        clickable
                        onClick={() => chooseNone(group)}
                        color={isNone ? 'secondary' : 'default'}
                        variant={isNone ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 600, fontStyle: 'italic' }}
                      />
                    )}
                    {group.items.map((item) => {
                      const selected = picked.includes(item.id);
                      const disabled = !selected && max > 1 && picked.length >= max;
                      return (
                        <Chip
                          key={item.id}
                          label={item.name}
                          clickable={!disabled}
                          disabled={disabled}
                          onClick={() => toggle(group, max, item.id)}
                          color={selected ? 'primary' : 'default'}
                          variant={selected ? 'filled' : 'outlined'}
                          sx={{ fontWeight: 600 }}
                        />
                      );
                    })}
                  </Stack>
                </Box>
              );
            })}

            {summary.length > 0 && (
              <Typography variant="body2" sx={{ mt: 1.5, fontStyle: 'italic' }}>
                Tu selección: {summary.join(' · ')}
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
            {addLabel}
          </Button>
        )}
      </DialogActions>
    </>
  );
}
