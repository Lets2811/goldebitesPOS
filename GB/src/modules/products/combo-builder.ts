import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api/api-client';
import type { ApiResponse } from '../../lib/api/api-types';
import { useCurrentBusiness } from '../businesses/hooks/use-current-business';
import type { Business } from '../businesses/types/business.types';
import type { ProductMenuAvailability } from './types/product.types';

/** What "Arma tu combo" is called, and says, until the business names it its own way. */
export const DEFAULT_COMBO_BUILDER_NAME = 'Arma tu combo';
export const DEFAULT_COMBO_BUILDER_DESCRIPTION = 'Escoge lo que quieras, a tu gusto y a tu estilo.';

/** The name the business gives "Arma tu combo" (the default until it sets one). */
export function useComboBuilderName(): string {
  const { data: business } = useCurrentBusiness();
  return business?.comboBuilderName || DEFAULT_COMBO_BUILDER_NAME;
}

export function useUpdateComboBuilder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string | null; description: string | null }) => {
      const { data } = await apiClient.patch<ApiResponse<Business>>('/businesses/me/combo-builder', payload);
      return data.data;
    },
    onSuccess: (business) => {
      queryClient.setQueryData(['businesses', 'me'], business);
      queryClient.invalidateQueries({ queryKey: ['public-menu'] });
    },
  });
}

/** Where a product is offered, with the combo under the business's name. */
export function menuAvailabilityLabel(value: ProductMenuAvailability, comboName: string): string {
  if (value === 'MENU') return 'Solo menú';
  return value === 'BUILDER' ? `Solo «${comboName}»` : `Menú y «${comboName}»`;
}
