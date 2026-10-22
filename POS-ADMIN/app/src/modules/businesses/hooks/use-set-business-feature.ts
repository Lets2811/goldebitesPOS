import { useMutation, useQueryClient } from '@tanstack/react-query';
import { platformAdminApi } from '../api/platform-admin.api';
import { platformAdminKeys } from '../api/platform-admin.keys';

export function useSetBusinessFeature(businessId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ featureKey, enabled }: { featureKey: string; enabled: boolean }) =>
      platformAdminApi.setFeature(businessId, featureKey, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformAdminKeys.features(businessId) });
    },
  });
}
