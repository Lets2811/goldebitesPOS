import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api/api-client';
import type { ApiResponse } from '../../lib/api/api-types';
import { useAuthStore } from '../auth/store/auth.store';
import type { Product } from './types/product.types';

/** A product as a branch sells it: at its price, and whether it ran out there. */
export type BranchMenuProduct = Product & { outOfStock: boolean };

export const branchMenuKeys = {
  all: ['branch-menu'] as const,
  menu: (branchId: string | null) => ['branch-menu', 'menu', branchId] as const,
};

export const branchMenuApi = {
  async menu(branchId: string | null): Promise<BranchMenuProduct[]> {
    const { data } = await apiClient.get<ApiResponse<BranchMenuProduct[]>>('/products/menu', {
      params: branchId ? { branchId } : {},
    });
    return data.data;
  },
};

/**
 * What a branch sells (the session's, unless another is given): the products
 * it offers, at its prices, with the ones it ran out of marked. Refreshed
 * often: a sale can use up the last of an ingredient.
 */
export function useBranchMenu(branchId?: string | null) {
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? null);
  const id = branchId === undefined ? sessionBranchId : branchId;
  return useQuery({
    queryKey: branchMenuKeys.menu(id),
    queryFn: () => branchMenuApi.menu(id),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/**
 * Brings a product to another branch: an independent copy there, with its
 * recipe made from that branch's items (created, with no stock, if missing).
 */
export function useCopyProductToBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, branchId }: { productId: string; branchId: string }) => {
      const { data } = await apiClient.post<ApiResponse<Product>>(
        `/products/${productId}/copy-to-branch`,
        {
          branchId,
        },
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['branch-menu'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
