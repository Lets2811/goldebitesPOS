import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { branchesKeys } from '../../../shared/modules/branches/api/branches.keys';
import { platformAdminApi } from '../api/platform-admin.api';
import { platformAdminKeys } from '../api/platform-admin.keys';
import type { BranchDetailsPayload } from '../types/platform-admin.types';

/** Every branch of a business, active or not, for the platform to manage. */
export function useBusinessBranches(businessId: string | null) {
  return useQuery({
    queryKey: platformAdminKeys.branches(businessId ?? ''),
    queryFn: () => platformAdminApi.getBranches(businessId as string),
    enabled: Boolean(businessId),
  });
}

/**
 * The changes the platform can make to a business's branches. Each one
 * refreshes that business's list, and the branch lists the business itself
 * sees, in case the platform admin is looking at their own business.
 */
export function useBusinessBranchMutations(businessId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: platformAdminKeys.branches(businessId) });
    queryClient.invalidateQueries({ queryKey: branchesKeys.all });
  };

  return {
    create: useMutation({
      mutationFn: (payload: BranchDetailsPayload & { name: string }) =>
        platformAdminApi.createBranch(businessId, payload),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ branchId, ...payload }: BranchDetailsPayload & { branchId: string }) =>
        platformAdminApi.updateBranch(businessId, branchId, payload),
      onSuccess,
    }),
    setStatus: useMutation({
      mutationFn: ({ branchId, isActive }: { branchId: string; isActive: boolean }) =>
        platformAdminApi.setBranchStatus(businessId, branchId, isActive),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (branchId: string) => platformAdminApi.deleteBranch(businessId, branchId),
      onSuccess,
    }),
  };
}
