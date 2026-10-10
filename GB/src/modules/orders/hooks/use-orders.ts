import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../api/orders.api';
import { orderKeys } from '../api/orders.keys';
import type { OrderFilters } from '../types/order.types';

interface UseOrdersOptions {
  refetchInterval?: number;
  /** Sigue consultando con la pestaña en segundo plano; sin esto el navegador pausa el sondeo al cambiar de pestaña. */
  refetchIntervalInBackground?: boolean;
  enabled?: boolean;
}

export function useOrders(filters: OrderFilters = {}, options: UseOrdersOptions = {}) {
  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: () => ordersApi.getOrders(filters),
    staleTime: 15_000,
    refetchInterval: options.refetchInterval ?? 30_000,
    refetchIntervalInBackground: options.refetchIntervalInBackground ?? false,
    enabled: options.enabled ?? true,
  });
}
