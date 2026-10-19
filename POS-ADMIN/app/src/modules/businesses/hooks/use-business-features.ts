import { useQuery } from '@tanstack/react-query';
import { platformAdminApi } from '../api/platform-admin.api';
import { platformAdminKeys } from '../api/platform-admin.keys';

export function useBusinessFeatures(businessId: string | null) {
  return useQuery({
    queryKey: platformAdminKeys.features(businessId ?? ''),
    queryFn: () => platformAdminApi.getFeatures(businessId as string),
    enabled: Boolean(businessId),
  });
}
