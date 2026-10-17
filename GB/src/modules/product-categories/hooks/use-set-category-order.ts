import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productCategoriesApi } from '../api/product-categories.api';
import { productCategoryKeys } from '../api/product-categories.keys';
import type { CategoryOrderScope } from '../types/product-category.types';

/** Guarda el orden de las secciones; el menú público lo toma en la siguiente carga. */
export function useSetCategoryOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scope, categoryIds }: { scope: CategoryOrderScope; categoryIds: string[] }) =>
      productCategoriesApi.setOrder(scope, categoryIds),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: productCategoryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['public-menu'] });
    },
  });
}
