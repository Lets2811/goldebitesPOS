import { useQuery } from '@tanstack/react-query';
import { publicMenuApi } from '../api/public-menu.api';

/** La plantilla propia de "Arma tu combo" (solo cuando el negocio tiene una). */
export function usePublicComboTemplate(businessId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['public-menu', businessId, 'combo-template'],
    queryFn: () => publicMenuApi.getComboTemplate(businessId as string),
    enabled: Boolean(businessId) && enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function usePublicMenu(businessId: string | undefined, branchId?: string) {
  return useQuery({
    queryKey: ['public-menu', businessId, branchId],
    queryFn: () => publicMenuApi.getMenu(businessId as string, branchId),
    // What ran out disappears without reloading the page.
    refetchInterval: 60_000,
    enabled: Boolean(businessId),
    retry: false,
  });
}
