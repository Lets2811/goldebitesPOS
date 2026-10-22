import { useMutation, useQueryClient } from '@tanstack/react-query';
import { platformAdminApi } from '../api/platform-admin.api';
import { platformAdminKeys } from '../api/platform-admin.keys';

export function useSetPlatformFeatureFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ featureKey, enabled }: { featureKey: string; enabled: boolean }) =>
      platformAdminApi.setFeatureFlag(featureKey, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformAdminKeys.featureFlags() });
    },
  });
}
