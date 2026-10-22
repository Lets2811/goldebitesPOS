import { useMutation, useQueryClient } from '@tanstack/react-query';
import { platformAdminApi } from '../api/platform-admin.api';
import { platformAdminKeys } from '../api/platform-admin.keys';
import type { CreatePlatformBusinessPayload } from '../types/platform-admin.types';

export function useCreatePlatformBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreatePlatformBusinessPayload) => platformAdminApi.createBusiness(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformAdminKeys.businesses() });
    },
  });
}
