import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api/api-client';
import type { ApiResponse } from '../../lib/api/api-types';
import { useAuthStore } from '../auth/store/auth.store';
import type { Product } from './types/product.types';

/** A product as a branch sells it: at its price, and whether it ran out there. */
export type BranchMenuProduct = Product & { outOfStock: boolean };

/** A product at one branch, for setting up the branch's menu. */
export interface ProductAtBranch {
  branchId: string;
  branchName: string;
  isAvailable: boolean;
  /** The branch's own price; null: the catalog's. */
  salePrice: number | null;
  outOfStock: boolean;
}

export const branchMenuKeys = {
  all: ['branch-menu'] as const,
  menu: (branchId: string | null) => ['branch-menu', 'menu', branchId] as const,
  product: (productId: string) => ['branch-menu', 'product', productId] as const,
};

export const branchMenuApi = {
  async menu(branchId: string | null): Promise<BranchMenuProduct[]> {
    const { data } = await apiClient.get<ApiResponse<BranchMenuProduct[]>>('/products/menu', {
      params: branchId ? { branchId } : {},
    });
    return data.data;
  },

  async productBranches(productId: string): Promise<ProductAtBranch[]> {
    const { data } = await apiClient.get<ApiResponse<ProductAtBranch[]>>(
      `/products/${productId}/branches`,
    );
    return data.data;
  },

  async setProductBranch(
    productId: string,
    branchId: string,
    payload: { isAvailable: boolean; salePrice: number | null },
  ): Promise<ProductAtBranch[]> {
    const { data } = await apiClient.put<ApiResponse<ProductAtBranch[]>>(
      `/products/${productId}/branches/${branchId}`,
      payload,
    );
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

export function useProductBranches(productId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: branchMenuKeys.product(productId ?? ''),
    queryFn: () => branchMenuApi.productBranches(productId as string),
    enabled: Boolean(productId) && enabled,
  });
}

export function useSetProductBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      branchId,
      isAvailable,
      salePrice,
    }: {
      productId: string;
      branchId: string;
      isAvailable: boolean;
      salePrice: number | null;
    }) => branchMenuApi.setProductBranch(productId, branchId, { isAvailable, salePrice }),
    onSuccess: (data, { productId }) => {
      queryClient.setQueryData(branchMenuKeys.product(productId), data);
      queryClient.invalidateQueries({ queryKey: ['branch-menu', 'menu'] });
    },
  });
}
