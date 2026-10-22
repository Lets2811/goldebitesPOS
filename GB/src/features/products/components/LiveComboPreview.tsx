import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Maximize2, UtensilsCrossed } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useCurrentBusiness } from '../../../modules/businesses/hooks/use-current-business';
import {
  DEFAULT_COMBO_BUILDER_DESCRIPTION,
  DEFAULT_COMBO_BUILDER_NAME,
} from '../../../modules/products/combo-builder';
import type { ProductCategory } from '../../../modules/product-categories/types/product-category.types';
import type { Product } from '../../../modules/products/types/product.types';
import { usePublicMenu } from '../../../modules/public-menu/hooks/use-public-menu';
import type { PublicMenuCategory } from '../../../modules/public-menu/types/public-menu.types';
import { brand } from '../../../theme/palette';
import ComboBuilderView from '../../public-menu/components/ComboBuilderView';

interface LiveComboPreviewProps {
  /** The sections in the order being arranged, each with its combo products. */
  sections: { category: ProductCategory; products: Product[] }[];
  uncategorized: Product[];
  /** Opens the template editor in full screen. */
  onOpenEditor?: () => void;
}

/**
 * "Arma tu combo" exactly as the customer gets it — the business's template,
 * or the default view — in a phone, with the sections in the order being
 * arranged right now: dragging a section moves it here too.
 */
export default function LiveComboPreview({
  sections,
  uncategorized,
  onOpenEditor,
}: LiveComboPreviewProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { data: business } = useCurrentBusiness();
  const branchId = useAuthStore((s) => s.user?.branchId ?? undefined);
  // Only the option groups come from the customer menu; the products, from the order on screen.
  const { data: menu } = usePublicMenu(business?.id, branchId);
  const hasTemplate = business?.hasComboBuilderTemplate ?? false;
  const { data: template } = useQuery({
    queryKey: ['businesses', 'me', 'combo-template'],
    queryFn: async () =>
      (
        await apiClient.get<ApiResponse<{ html: string | null }>>(
          '/businesses/me/combo-builder/template',
        )
      ).data.data.html,
    enabled: hasTemplate,
  });
  const [readOnly, setReadOnly] = useState(false);

  const categories: PublicMenuCategory[] = useMemo(() => {
    const toCategory = (
      id: string | null,
      name: string,
      products: Product[],
    ): PublicMenuCategory => ({
      id,
      name,
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        salePrice: product.salePrice,
        description: product.description,
        imageUrl: product.imageUrl,
        optionGroups: product.optionGroups,
      })),
    });
    const list = sections
      .filter((section) => section.products.length > 0)
      .map((section) => toCategory(section.category.id, section.category.name, section.products));
    if (uncategorized.length > 0) list.push(toCategory(null, 'Otros', uncategorized));
    return list;
  }, [sections, uncategorized]);

  return (
    <Stack spacing={1.25} sx={{ alignItems: 'center' }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={readOnly ? 'browse' : 'order'}
        onChange={(_e, value) => value && setReadOnly(value === 'browse')}
      >
        <ToggleButton value="order">Pide</ToggleButton>
        <ToggleButton value="browse">Solo consulta</ToggleButton>
      </ToggleButtonGroup>

      <Box
        sx={{
          width: 360,
          maxWidth: '100%',
          height: 680,
          borderRadius: 6,
          border: '10px solid #1b1b1f',
          boxShadow: 6,
          overflow: 'hidden',
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pt: 2.5 }}>
          <Stack sx={{ alignItems: 'center', textAlign: 'center', mb: 2 }} spacing={0.5}>
            <UtensilsCrossed size={20} color={brand.gold} strokeWidth={1.75} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {business?.name ?? ''}
            </Typography>
          </Stack>
          {hasTemplate && template === undefined ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
              Cargando la plantilla…
            </Typography>
          ) : (
            <ComboBuilderView
              title={business?.comboBuilderName || DEFAULT_COMBO_BUILDER_NAME}
              description={business?.comboBuilderDescription || DEFAULT_COMBO_BUILDER_DESCRIPTION}
              categories={categories}
              optionGroups={menu?.optionGroups ?? []}
              readOnly={readOnly}
              template={hasTemplate ? template : null}
              onBack={() =>
                enqueueSnackbar('En la página real, este botón vuelve al menú.', {
                  variant: 'info',
                })
              }
              onAddCombo={() =>
                enqueueSnackbar(
                  'Es una vista previa: el combo se armó bien, pero no se pide nada.',
                  { variant: 'info' },
                )
              }
            />
          )}
        </Box>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
        {hasTemplate ? 'Con tu plantilla.' : 'Con la vista por defecto.'} Se puede usar: agrega
        productos y elige sus opciones.
      </Typography>
      {onOpenEditor && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<Maximize2 size={15} />}
          onClick={onOpenEditor}
        >
          {hasTemplate ? 'Editar plantilla en pantalla completa' : 'Diseñar con una plantilla'}
        </Button>
      )}
    </Stack>
  );
}
