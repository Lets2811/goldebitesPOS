import { useQuery } from '@tanstack/react-query';
import { platformAdminApi } from '../api/platform-admin.api';
import { platformAdminKeys } from '../api/platform-admin.keys';

export function usePlatformFeatureFlags() {
  return useQuery({
    queryKey: platformAdminKeys.featureFlags(),
    queryFn: () => platformAdminApi.getFeatureFlags(),
  });
}
