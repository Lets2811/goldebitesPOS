import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../auth/store/auth.store';
import { productsApi } from '../api/products.api';
import { productKeys } from '../api/products.keys';
import type { ProductFilters } from '../types/product.types';

/** A branch's catalog: the session's unless another is asked for (in "Todas las sedes", every branch's). */
export function useProducts(filters: ProductFilters = {}) {
  const sessionBranchId = useAuthStore((s) => s.user?.branchId ?? undefined);
  const scoped = { ...filters, branchId: filters.branchId ?? sessionBranchId };
  return useQuery({
    queryKey: productKeys.list(scoped),
    queryFn: () => productsApi.getProducts(scoped),
    staleTime: 30_000,
  });
}
