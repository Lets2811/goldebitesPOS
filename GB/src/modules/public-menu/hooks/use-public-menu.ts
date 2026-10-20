import { useQuery } from '@tanstack/react-query';
import { publicMenuApi } from '../api/public-menu.api';

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
