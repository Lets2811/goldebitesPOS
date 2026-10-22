import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse } from '../../shared/lib/api/api-types';
import type { PlatformTuraStatus, TuraLinkCode } from '../../shared/modules/tura-links/types/tura-link.types';
import { adminApiClient } from '../../lib/admin-api-client';

/** TURA (the assistant) for a business: whether it has it, and linking its users. */
export const turaLinksKeys = {
  platform: (businessId: string) => ['admin', 'tura', businessId] as const,
};

const api = {
  async status(businessId: string): Promise<PlatformTuraStatus> {
    const { data } = await adminApiClient.get<ApiResponse<PlatformTuraStatus>>(`/businesses/${businessId}/tura`);
    return data.data;
  },
  async generateCode(businessId: string, userId: string): Promise<TuraLinkCode> {
    const { data } = await adminApiClient.post<ApiResponse<TuraLinkCode>>(`/businesses/${businessId}/tura/codes`, {
      userId,
    });
    return data.data;
  },
  async revoke(businessId: string, id: string): Promise<void> {
    await adminApiClient.delete(`/businesses/${businessId}/tura/links/${id}`);
  },
};

export function usePlatformTura(businessId: string) {
  return useQuery({ queryKey: turaLinksKeys.platform(businessId), queryFn: () => api.status(businessId) });
}

export function useGeneratePlatformTuraCode(businessId: string) {
  return useMutation({ mutationFn: (userId: string) => api.generateCode(businessId, userId) });
}

export function useRevokePlatformTuraLink(businessId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.revoke(businessId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: turaLinksKeys.platform(businessId) }),
  });
}
