import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api/api-client';
import type { ApiResponse } from '../../lib/api/api-types';
import { inventoryKeys } from './api/inventory.keys';

/** An inventory item at one branch: its stock there and the minimum it is held to. */
export interface InventoryItemAtBranch {
  branchId: string;
  branchName: string;
  stock: number;
  /** The branch's own minimum; null: the item's general one. */
  minimumStock: number | null;
  effectiveMinimum: number;
}

const keys = {
  item: (itemId: string) => [...inventoryKeys.all, 'item-branches', itemId] as const,
  minimums: (branchId: string | null) =>
    [...inventoryKeys.all, 'branch-minimums', branchId] as const,
};

export const branchMinimumsApi = {
  async itemBranches(itemId: string): Promise<InventoryItemAtBranch[]> {
    const { data } = await apiClient.get<ApiResponse<InventoryItemAtBranch[]>>(
      `/inventory-items/${itemId}/branches`,
    );
    return data.data;
  },

  async minimumsAt(branchId: string): Promise<{ inventoryItemId: string; minimumStock: number }[]> {
    const { data } = await apiClient.get<
      ApiResponse<{ inventoryItemId: string; minimumStock: number }[]>
    >('/inventory-items/branch-minimums', { params: { branchId } });
    return data.data;
  },

  async setMinimum(
    itemId: string,
    branchId: string,
    minimumStock: number | null,
  ): Promise<InventoryItemAtBranch[]> {
    const { data } = await apiClient.put<ApiResponse<InventoryItemAtBranch[]>>(
      `/inventory-items/${itemId}/branches/${branchId}`,
      { minimumStock },
    );
    return data.data;
  },
};

export function useItemBranches(itemId: string | null | undefined) {
  return useQuery({
    queryKey: keys.item(itemId ?? ''),
    queryFn: () => branchMinimumsApi.itemBranches(itemId as string),
    enabled: Boolean(itemId),
  });
}

/** The minimum each item is held to at a branch: its own there, or the general one. */
export function useBranchMinimums(branchId: string | null | undefined) {
  const { data } = useQuery({
    queryKey: keys.minimums(branchId ?? null),
    queryFn: () => branchMinimumsApi.minimumsAt(branchId as string),
    enabled: Boolean(branchId),
    staleTime: 60_000,
  });
  return new Map((data ?? []).map((row) => [row.inventoryItemId, row.minimumStock]));
}

export function useSetItemBranchMinimum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      branchId,
      minimumStock,
    }: {
      itemId: string;
      branchId: string;
      minimumStock: number | null;
    }) => branchMinimumsApi.setMinimum(itemId, branchId, minimumStock),
    onSuccess: (data, { itemId }) => {
      queryClient.setQueryData(keys.item(itemId), data);
      queryClient.invalidateQueries({ queryKey: [...inventoryKeys.all, 'branch-minimums'] });
      queryClient.invalidateQueries({ queryKey: [...inventoryKeys.all, 'low-stock'] });
    },
  });
}
