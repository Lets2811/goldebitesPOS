import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ArrowLeft, Plus, Sparkles, UtensilsCrossed, X } from 'lucide-react';
import { formatCOP } from '../../../utils/format';
import { brand } from '../../../theme/palette';
import type {
  PublicMenuCategory,
  PublicMenuOptionGroup,
  PublicMenuProduct,
} from '../../../modules/public-menu/types/public-menu.types';
import { describeSelection, type CartSelection } from '../hooks/use-public-cart';
import { noneLabel } from '../../../modules/option-groups/utils/option-group-utils';
import ProductDetailDialog from './ProductDetailDialog';
import ComboTemplateFrame from '../combo-template/ComboTemplateFrame';
import type {
  ComboTemplateData,
  ComboTemplateOptions,
  ComboTemplateState,
} from '../combo-template/combo-template-runtime';

/** Un producto elegido para el combo, con lo que el cliente le eligió. */
interface ComboUnit {
  key: number;
  product: PublicMenuProduct;
  selection: CartSelection;
}

/** Desde cuántos productos es un combo: uno solo se pide desde el menú normal. */
export const MIN_COMBO_ITEMS = 2;

interface ComboBuilderViewProps {
  /** Lo que el negocio le llama ("Arma tu combo" por defecto) y su frase. */
  title: string;
  description: string;
  categories: PublicMenuCategory[];
  optionGroups: PublicMenuOptionGroup[];
  /** Solo de consulta (enlace público, mesa sin autoservicio): se ven los productos, no se arma nada. */
  readOnly: boolean;
  /** The business's own HTML template; absent: this default view. */
  template?: string | null;
  onBack: () => void;
  onAddCombo: (units: { product: PublicMenuProduct; selection: CartSelection }[]) => void;
}

/**
 * "Arma tu combo" en su propia página (…/combo): el cliente junta los
 * productos que quiera de los que el negocio ofrece para armar, cada uno con
 * lo que quiera elegirle, y los agrega al pedido como un solo combo. Cuesta la
 * suma de lo elegido. Solo de consulta, muestra qué se puede combinar.
 */
export default function ComboBuilderView({
  title,
  description,
  categories,
  optionGroups,
  readOnly,
  template,
  onBack,
  onAddCombo,
}: ComboBuilderViewProps) {
  const [units, setUnits] = useState<ComboUnit[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [picking, setPicking] = useState<PublicMenuProduct | null>(null);

  const total = units.reduce((sum, unit) => sum + unit.product.salePrice, 0);
  const ready = units.length >= MIN_COMBO_ITEMS;
  const hasProducts = categories.some((category) => category.products.length > 0);

  const add = (product: PublicMenuProduct, selection: CartSelection) => {
    setUnits((current) => [...current, { key: nextKey, product, selection }]);
    setNextKey((key) => key + 1);
  };

  const productsById = useMemo(
    () =>
      new Map(
        categories.flatMap((category) => category.products).map((product) => [product.id, product]),
      ),
    [categories],
  );

  /** The option groups a product lets the customer choose from, with how many of each. */
  const offeredFor = (product: PublicMenuProduct) => {
    const maxByGroup = new Map(product.optionGroups.map((o) => [o.groupId, o.maxChoices]));
    return optionGroups
      .filter((group) => maxByGroup.has(group.id) && group.items.length > 0)
      .map((group) => ({ group, max: maxByGroup.get(group.id)! }));
  };

  /** Options chosen inside the template, waiting to be shown there. */
  const [optionsRequest, setOptionsRequest] = useState<{
    seq: number;
    options: ComboTemplateOptions;
  } | null>(null);

  /**
   * A tap on a product: one with nothing to choose goes straight into the
   * combo, no confirmation. One with options opens their choice — in the
   * template's own card when there is a template, in the default dialog if not.
   */
  const pick = (product: PublicMenuProduct) => {
    const offered = offeredFor(product);
    if (readOnly) {
      if (!template) setPicking(product);
      return;
    }
    if (offered.length === 0) {
      add(product, { optionItemIds: [], noneGroupIds: [] });
      return;
    }
    if (!template) {
      setPicking(product);
      return;
    }
    setOptionsRequest((current) => ({
      seq: (current?.seq ?? 0) + 1,
      options: {
        productId: product.id,
        nombre: product.name,
        grupos: offered.map(({ group, max }) => ({
          id: group.id,
          nombre: group.name,
          max,
          obligatorio: group.isRequired,
          sin: noneLabel(group.name),
          opciones: group.items.map((item) => ({ id: item.id, nombre: item.name })),
        })),
      },
    }));
  };

  /** What the template says was chosen, checked against the product's own rules before it counts. */
  const choose = (productId: string, optionItemIds: string[], noneGroupIds: string[]) => {
    const product = productsById.get(productId);
    if (!product) return;
    const offered = offeredFor(product);
    const valid =
      optionItemIds.every((id) =>
        offered.some(({ group }) => group.items.some((item) => item.id === id)),
      ) &&
      noneGroupIds.every((id) =>
        offered.some(({ group }) => group.id === id && !group.isRequired),
      ) &&
      offered.every(({ group, max }) => {
        const picked = group.items.filter((item) => optionItemIds.includes(item.id)).length;
        const none = noneGroupIds.includes(group.id);
        return picked <= max && !(picked > 0 && none) && (picked > 0 || none);
      });
    if (valid) add(product, { optionItemIds, noneGroupIds });
  };

  const describe = (unit: ComboUnit) => describeSelection(unit.selection, optionGroups).join(' · ');

  // What a business's own template gets, and what it is told as the customer picks.
  const templateData = useMemo<ComboTemplateData>(
    () => ({
      combo: { nombre: title, frase: description, minimo: MIN_COMBO_ITEMS },
      secciones: categories
        .filter((category) => category.products.length > 0)
        .map((category) => ({
          nombre: category.name,
          productos: category.products.map((product) => ({
            id: product.id,
            nombre: product.name,
            descripcion: product.description ?? '',
            precio: formatCOP(product.salePrice),
            valor: product.salePrice,
            imagen: product.imageUrl ? new URL(product.imageUrl, window.location.origin).href : '',
          })),
        })),
      soloConsulta: readOnly,
    }),
    [title, description, categories, readOnly],
  );
  const templateState = useMemo<ComboTemplateState>(() => {
    const counts: Record<string, number> = {};
    for (const unit of units) counts[unit.product.id] = (counts[unit.product.id] ?? 0) + 1;
    return { counts, total: formatCOP(total), cantidad: units.length };
  }, [units, total]);

  return (
    <Box>
      <Button
        startIcon={<ArrowLeft size={16} />}
        onClick={onBack}
        sx={{ mb: 2, color: 'text.secondary' }}
      >
        Volver al menú
      </Button>

      {template ? (
        <Box sx={{ mx: -2, mb: 2 }}>
          <ComboTemplateFrame
            template={template}
            data={templateData}
            state={templateState}
            onPick={(productId) => {
              const product = productsById.get(productId);
              if (product) pick(product);
            }}
            optionsRequest={optionsRequest}
            onChoose={choose}
            onRemove={(productId) =>
              setUnits((current) => {
                const last = current.map((unit) => unit.product.id).lastIndexOf(productId);
                return last < 0 ? current : current.filter((_, index) => index !== last);
              })
            }
          />
        </Box>
      ) : (
        <>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{
              alignItems: 'center',
              mb: 4,
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: brand.gold,
              background: `linear-gradient(135deg, ${brand.gold}22, transparent 70%)`,
            }}
          >
            <Sparkles size={28} color={brand.gold} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
              {!readOnly && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  Elige al menos {MIN_COMBO_ITEMS} productos: pagas la suma de lo que escojas.
                </Typography>
              )}
            </Box>
          </Stack>

          {!hasProducts && (
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center' }}>
              Por ahora no hay productos para armar combos.
            </Typography>
          )}

          <Stack spacing={4}>
            {categories
              .filter((category) => category.products.length > 0)
              .map((category) => (
                <Box key={category.id ?? 'uncategorized'}>
                  <Typography
                    variant="overline"
                    sx={{ color: brand.gold, fontWeight: 700, letterSpacing: 1.5 }}
                  >
                    {category.name}
                  </Typography>
                  <Divider sx={{ mb: 1.5, mt: 0.5, borderColor: brand.gold, opacity: 0.3 }} />
                  <Stack spacing={0.5}>
                    {category.products.map((product) => {
                      const chosen = units.filter((unit) => unit.product.id === product.id).length;
                      return (
                        <ButtonBase
                          key={product.id}
                          onClick={() => pick(product)}
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
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
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
                              <UtensilsCrossed size={20} color={brand.gold} strokeWidth={1.5} />
                            )}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {product.name}
                              {chosen > 0 ? ` ×${chosen}` : ''}
                            </Typography>
                            {product.description && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                                sx={{ display: 'block' }}
                              >
                                {product.description}
                              </Typography>
                            )}
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                          >
                            {formatCOP(product.salePrice)}
                          </Typography>
                          {!readOnly && <Plus size={18} color={brand.gold} />}
                        </ButtonBase>
                      );
                    })}
                  </Stack>
                </Box>
              ))}
          </Stack>
        </>
      )}

      {!readOnly && hasProducts && (
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            mt: 4,
            mx: -2,
            px: 2,
            py: 2,
            bgcolor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'divider',
            boxShadow: 6,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Tu combo
          </Typography>
          {units.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Toca los productos para agregarlos.
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
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ display: 'block' }}
                      >
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
              setUnits([]);
            }}
            sx={{ fontWeight: 800 }}
          >
            {ready
              ? `Agregar combo · ${formatCOP(total)}`
              : `Elige al menos ${MIN_COMBO_ITEMS} productos (${units.length}/${MIN_COMBO_ITEMS})`}
          </Button>
        </Box>
      )}

      <ProductDetailDialog
        product={picking}
        optionGroups={optionGroups}
        onAdd={add}
        onClose={() => setPicking(null)}
        addLabel="Agregar al combo"
        readOnly={readOnly}
      />
    </Box>
  );
}
