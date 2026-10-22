import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse } from '../../shared/lib/api/api-types';
import { adminApiClient } from '../../lib/admin-api-client';

/** A business's master key ("clave maestra"), to rectify closed cash sessions in its POS. */
export interface MasterKeyStatus {
  hasOwnKey: boolean;
  /** Without its own key, the old platform-wide key still applies to the business. */
  usesPlatformKey: boolean;
  /** Only when revealed. */
  key: string | null;
  updatedAt: string | null;
}

const keys = {
  status: (businessId: string) => ['admin', 'master-key', businessId] as const,
};

const api = {
  async status(businessId: string, reveal: boolean): Promise<MasterKeyStatus> {
    const { data } = await adminApiClient.get<ApiResponse<MasterKeyStatus>>(`/businesses/${businessId}/master-key`, {
      params: reveal ? { reveal: 'true' } : {},
    });
    return data.data;
  },
  async reset(businessId: string, key?: string): Promise<MasterKeyStatus> {
    const { data } = await adminApiClient.post<ApiResponse<MasterKeyStatus>>(
      `/businesses/${businessId}/master-key/reset`,
      key ? { key } : {},
    );
    return data.data;
  },
};

export function useMasterKeyStatus(businessId: string) {
  return useQuery({ queryKey: keys.status(businessId), queryFn: () => api.status(businessId, false) });
}

/** Shows the key (each reveal is recorded in the business's audit log). */
export function useRevealMasterKey(businessId: string) {
  return useMutation({ mutationFn: () => api.status(businessId, true) });
}

export function useResetMasterKey(businessId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key?: string) => api.reset(businessId, key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.status(businessId) }),
  });
}
