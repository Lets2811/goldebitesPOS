import { useQuery } from '@tanstack/react-query';
import { platformAdminApi } from '../api/platform-admin.api';
import { platformAdminKeys } from '../api/platform-admin.keys';

export function useBusinessUsers(businessId: string | null) {
  return useQuery({
    queryKey: platformAdminKeys.users(businessId ?? ''),
    queryFn: () => platformAdminApi.getUsers(businessId as string),
    enabled: Boolean(businessId),
  });
}
