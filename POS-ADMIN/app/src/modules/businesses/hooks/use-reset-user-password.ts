import { useMutation } from '@tanstack/react-query';
import { platformAdminApi } from '../api/platform-admin.api';

export function useResetUserPassword(businessId: string) {
  return useMutation({
    mutationFn: (userId: string) => platformAdminApi.resetUserPassword(businessId, userId),
  });
}
