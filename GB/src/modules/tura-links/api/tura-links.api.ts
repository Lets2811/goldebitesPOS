import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import type { PlatformTuraStatus, TuraLink, TuraLinkCode } from '../types/tura-link.types';

export const turaLinksKeys = {
  all: ['tura-links'] as const,
  platform: (businessId: string) => ['tura-links', 'platform', businessId] as const,
};

export const turaLinksApi = {
  async getAll(): Promise<TuraLink[]> {
    const { data } = await apiClient.get<ApiResponse<TuraLink[]>>('/tura-links');
    return data.data;
  },

  async generateCode(): Promise<TuraLinkCode> {
    const { data } = await apiClient.post<ApiResponse<TuraLinkCode>>('/tura-links/codes');
    return data.data;
  },

  async revoke(id: string): Promise<void> {
    await apiClient.delete(`/tura-links/${id}`);
  },
};

/** The platform admin managing TURA for any business. */
export const platformTuraApi = {
  async getStatus(businessId: string): Promise<PlatformTuraStatus> {
    const { data } = await apiClient.get<ApiResponse<PlatformTuraStatus>>(
      `/platform-admin/businesses/${businessId}/tura`,
    );
    return data.data;
  },

  async generateCode(businessId: string, userId: string): Promise<TuraLinkCode> {
    const { data } = await apiClient.post<ApiResponse<TuraLinkCode>>(
      `/platform-admin/businesses/${businessId}/tura/codes`,
      { userId },
    );
    return data.data;
  },

  async revoke(businessId: string, id: string): Promise<void> {
    await apiClient.delete(`/platform-admin/businesses/${businessId}/tura/links/${id}`);
  },
};
