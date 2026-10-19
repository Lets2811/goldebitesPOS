import { useQuery } from '@tanstack/react-query';
import { platformAdminApi } from '../api/platform-admin.api';
import { platformAdminKeys } from '../api/platform-admin.keys';

export function usePlatformBusinesses() {
  return useQuery({
    queryKey: platformAdminKeys.businesses(),
    queryFn: () => platformAdminApi.getBusinesses(),
    staleTime: 30_000,
  });
}
