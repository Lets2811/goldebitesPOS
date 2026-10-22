import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../auth/store/auth.store';
import { inventoryApi } from '../api/inventory.api';
import { inventoryKeys } from '../api/inventory.keys';
import type { InventoryItemFilters } from '../types/inventory.types';

/** A branch's items: the session's unless another is asked for (in "Todas las sedes", every branch's). */
export function useInventoryItems(filters: InventoryItemFilters = {}) {
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? undefined);
  const scoped = { ...filters, branchId: filters.branchId ?? sessionBranchId };
  return useQuery({
    queryKey: inventoryKeys.itemList(scoped),
    queryFn: () => inventoryApi.getItems(scoped),
    staleTime: 30_000,
  });
}
