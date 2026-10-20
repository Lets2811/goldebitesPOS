import { useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { ArrowDown, ArrowUp, Check, GripVertical, Sparkles, UtensilsCrossed } from 'lucide-react';
import CircularProgress from '@mui/material/CircularProgress';
import { useSnackbar } from 'notistack';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useProductCategories } from '../../../modules/product-categories/hooks/use-product-categories';
import { useSetCategoryOrder } from '../../../modules/product-categories/hooks/use-set-category-order';
import type { CategoryOrderScope, ProductCategory } from '../../../modules/product-categories/types/product-category.types';
import { useProducts } from '../../../modules/products/hooks/use-products';
import type { Product } from '../../../modules/products/types/product.types';
import { brand } from '../../../theme/palette';
import { formatCOP } from '../../../utils/format';
import { useComboBuilderName } from '../../../modules/products/combo-builder';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import ComboBuilderNameCard from './ComboBuilderNameCard';

/** Lo que el cliente ve en cada lista: el menú no muestra lo que es solo de combo, y al revés. */
const offeredIn = (product: Product, scope: CategoryOrderScope) =>
  scope === 'MENU' ? product.menuAvailability !== 'BUILDER' : product.menuAvailability !== 'MENU';

const orderOf = (category: ProductCategory, scope: CategoryOrderScope) =>
  scope === 'MENU' ? category.displayOrder : category.builderDisplayOrder;

function sameOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** Un celular con el menú tal como lo verá el cliente, en el orden que se está armando. */
function PhonePreview({
  scope,
  sections,
  uncategorized,
  activeId,
}: {
  scope: CategoryOrderScope;
  sections: { category: ProductCategory; products: Product[] }[];
  uncategorized: Product[];
  activeId: string | null;
}) {
  const comboName = useComboBuilderName();
  const visible = sections.filter((section) => section.products.length > 0);
  const renderSection = (key: string, name: string, products: Product[], active: boolean) => (
    <Box
      key={key}
      sx={{
        borderRadius: 1.5,
        px: 1,
        py: 0.75,
        mx: -1,
        transition: 'background-color 150ms',
        backgroundColor: active ? alpha(brand.gold, 0.16) : 'transparent',
      }}
    >
      <Typography variant="overline" sx={{ color: brand.gold, fontWeight: 700, letterSpacing: 1.2, fontSize: '0.62rem' }}>
        {name}
      </Typography>
      <Divider sx={{ mb: 0.75, borderColor: brand.gold, opacity: 0.3 }} />
      {products.slice(0, 4).map((product) => (
        <Stack key={product.id} direction="row" sx={{ justifyContent: 'space-between', py: 0.35, gap: 1 }}>
          <Typography variant="caption" noWrap sx={{ fontWeight: 600 }}>
            {product.name}
          </Typography>
          <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
            {formatCOP(product.salePrice)}
          </Typography>
        </Stack>
      ))}
      {products.length > 4 && (
        <Typography variant="caption" color="text.secondary">
          +{products.length - 4} más
        </Typography>
      )}
    </Box>
  );

  return (
    <Box
      sx={{
        width: 290,
        maxWidth: '100%',
        mx: 'auto',
        p: 1.25,
        borderRadius: 5,
        border: '2px solid',
        borderColor: 'divider',
        backgroundColor: (theme) => alpha(theme.palette.text.primary, 0.03),
      }}
    >
      <Box sx={{ width: 70, height: 5, borderRadius: 3, bgcolor: 'divider', mx: 'auto', mb: 1.25 }} />
      <Box sx={{ height: 520, overflowY: 'auto', px: 1.5, py: 1, borderRadius: 3, bgcolor: 'background.default' }}>
        <Stack sx={{ alignItems: 'center', mb: 2, mt: 1 }} spacing={0.5}>
          {scope === 'MENU' ? (
            <UtensilsCrossed size={20} color={brand.gold} />
          ) : (
            <Sparkles size={20} color={brand.gold} />
          )}
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            {scope === 'MENU' ? 'Menú' : comboName}
          </Typography>
        </Stack>
        {visible.length === 0 && uncategorized.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 4 }}>
            {scope === 'MENU'
              ? 'No hay productos visibles en el menú.'
              : `Ningún producto está marcado para «${comboName}».`}
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {visible.map((section) =>
              renderSection(section.category.id, section.category.name, section.products, section.category.id === activeId),
            )}
            {uncategorized.length > 0 && renderSection('uncategorized', 'Otros', uncategorized, false)}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

/**
 * Organizar menú: el orden de las secciones que ve el cliente, en el menú y
 * en "Arma tu combo" (cada uno con su propio orden). Se arrastra y se suelta,
 * o se usan las flechas, con la vista previa del celular siguiendo en vivo.
 * Cada cambio se guarda al soltar.
 */
export default function MenuOrganizerTab({ initialScope = 'MENU' }: { initialScope?: CategoryOrderScope }) {
  const { enqueueSnackbar } = useSnackbar();
  const [scope, setScope] = useState<CategoryOrderScope>(initialScope);
  const comboName = useComboBuilderName();
  const { hasPermission } = usePermissions();
  const { data: categoryPage, isLoading: categoriesLoading } = useProductCategories({ isActive: true, limit: 100 });
  const { data: productPage, isLoading: productsLoading } = useProducts({ isActive: true, isVisible: true, limit: 100 });
  const setOrderMutation = useSetCategoryOrder();

  const categories = useMemo(() => categoryPage?.data ?? [], [categoryPage]);
  const products = useMemo(() => productPage?.data ?? [], [productPage]);

  // El orden guardado de la lista elegida: el punto de partida y contra qué comparar al soltar.
  const savedOrder = useMemo(
    () =>
      [...categories]
        .sort((a, b) => orderOf(a, scope) - orderOf(b, scope) || a.name.localeCompare(b.name))
        .map((category) => category.id),
    [categories, scope],
  );
  const [order, setOrder] = useState<string[]>(savedOrder);
  const [trackedKey, setTrackedKey] = useState('');
  const key = `${scope}:${savedOrder.join(',')}`;
  if (key !== trackedKey) {
    setTrackedKey(key);
    setOrder(savedOrder);
  }

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const orderAtDragStart = useRef<string[]>([]);
  const [savedTick, setSavedTick] = useState(false);

  const byId = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const allSections = order
    .map((id) => byId.get(id))
    .filter((category): category is ProductCategory => Boolean(category))
    .map((category) => ({
      category,
      products: products
        .filter((product) => product.categoryId === category.id && offeredIn(product, scope))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  const uncategorized = products.filter((product) => !product.categoryId && offeredIn(product, scope));
  // Solo se ordenan las secciones que el cliente ve en esta lista: cruzarse con una que no aparece no cambiaría nada a la vista.
  const sections = allSections.filter((section) => section.products.length > 0);
  const hiddenSections = allSections.filter((section) => section.products.length === 0);
  const shownIds = new Set(sections.map((section) => section.category.id));

  /** Mueve entre las secciones visibles; las que no se muestran quedan al final, en su orden. */
  const moveShown = (list: string[], fromId: string, toId: string) => {
    const shown = list.filter((id) => shownIds.has(id));
    const rest = list.filter((id) => !shownIds.has(id));
    return [...move(shown.indexOf(fromId), shown.indexOf(toId), shown), ...rest];
  };

  const save = (next: string[]) => {
    if (sameOrder(next, savedOrder)) return;
    setSavedTick(false);
    setOrderMutation.mutate(
      { scope, categoryIds: next },
      {
        onSuccess: () => setSavedTick(true),
        onError: (error) => {
          setOrder(savedOrder);
          enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' });
        },
      },
    );
  };

  function move(from: number, to: number, list: string[]) {
    if (to < 0 || to >= list.length || from === to) return list;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }

  if (categoriesLoading || productsLoading) return <LoadingSkeleton variant="list" />;

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={scope}
          onChange={(_, value: CategoryOrderScope | null) => value && setScope(value)}
        >
          <ToggleButton value="MENU" sx={{ gap: 0.75 }}>
            <UtensilsCrossed size={15} /> Menú
          </ToggleButton>
          <ToggleButton value="BUILDER" sx={{ gap: 0.75 }}>
            <Sparkles size={15} /> {comboName}
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Arrastra las secciones para ordenarlas como las verá el cliente. Cada lista tiene su propio orden.
        </Typography>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary', minWidth: 110 }}>
          {setOrderMutation.isPending ? (
            <>
              <CircularProgress size={13} />
              <Typography variant="caption">Guardando…</Typography>
            </>
          ) : savedTick ? (
            <>
              <Check size={15} color={brand.gold} />
              <Typography variant="caption">Orden guardado</Typography>
            </>
          ) : null}
        </Stack>
      </Stack>

      {scope === 'BUILDER' && <ComboBuilderNameCard canEdit={hasPermission('products.update')} />}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 3, alignItems: 'start' }}>
        <Card variant="outlined" sx={{ p: 1 }}>
          {sections.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {scope === 'MENU'
                ? 'Ninguna sección tiene productos visibles en el menú.'
                : `Ninguna sección tiene productos para «${comboName}». Márcalos en cada producto, en "Disponible para el cliente en".`}
            </Typography>
          ) : (
            <Stack spacing={0.75}>
              {sections.map(({ category, products: sectionProducts }, index) => {
                const dragging = draggingId === category.id;
                return (
                  <Stack
                    key={category.id}
                    direction="row"
                    spacing={1.25}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', category.id);
                      orderAtDragStart.current = order;
                      setDraggingId(category.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (!draggingId || draggingId === category.id) return;
                      // Se reacomoda mientras se arrastra: la vista previa sigue el movimiento en vivo.
                      setOrder((current) => moveShown(current, draggingId, category.id));
                    }}
                    onDrop={(e) => e.preventDefault()}
                    onDragEnd={() => {
                      setDraggingId(null);
                      if (!sameOrder(order, orderAtDragStart.current)) save(order);
                    }}
                    sx={{
                      alignItems: 'center',
                      px: 1.25,
                      py: 1,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: dragging ? brand.gold : 'divider',
                      backgroundColor: dragging ? alpha(brand.gold, 0.1) : 'background.paper',
                      cursor: 'grab',
                      '&:active': { cursor: 'grabbing' },
                    }}
                  >
                    <GripVertical size={18} style={{ opacity: 0.6, flexShrink: 0 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ width: 22, fontVariantNumeric: 'tabular-nums' }}>
                      {index + 1}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                        {category.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                        {sectionProducts.length} producto{sectionProducts.length === 1 ? '' : 's'}
                      </Typography>
                    </Box>
                    <Tooltip title="Subir">
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`Subir ${category.name}`}
                          disabled={index === 0 || setOrderMutation.isPending}
                          onClick={() => {
                            const next = moveShown(order, category.id, sections[index - 1].category.id);
                            setOrder(next);
                            save(next);
                          }}
                        >
                          <ArrowUp size={16} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Bajar">
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`Bajar ${category.name}`}
                          disabled={index === sections.length - 1 || setOrderMutation.isPending}
                          onClick={() => {
                            const next = moveShown(order, category.id, sections[index + 1].category.id);
                            setOrder(next);
                            save(next);
                          }}
                        >
                          <ArrowDown size={16} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                );
              })}
              {uncategorized.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ px: 1.25, pt: 0.5 }}>
                  Los productos sin categoría salen al final, en "Otros".
                </Typography>
              )}
              {hiddenSections.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ px: 1.25, pt: 0.5 }}>
                  No aparecen en esta lista porque no tienen productos para ella:{' '}
                  {hiddenSections.map((section) => section.category.name).join(', ')}.
                </Typography>
              )}
            </Stack>
          )}
        </Card>

        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 1 }}>
            Así lo verá el cliente
          </Typography>
          <PhonePreview scope={scope} sections={sections} uncategorized={uncategorized} activeId={draggingId} />
        </Box>
      </Box>
    </Stack>
  );
}
