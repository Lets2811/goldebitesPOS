import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';
import { tokenStorage } from '../../../lib/api/token-storage';

/**
 * Takes the session to one branch, or to all of them (null): a new token pair
 * whose data is that branch's. Nothing from the branch it leaves is kept.
 */
export function useSwitchBranch() {
  const setSession = useAuthStore((s) => s.setSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (branchId: string | null) =>
      authApi.switchBranch(branchId, tokenStorage.getRefreshToken() ?? undefined),
    onSuccess: (data) => {
      queryClient.clear();
      tokenStorage.setRefreshToken(data.refreshToken);
      setSession({ user: data.user, accessToken: data.accessToken });
    },
  });
}
