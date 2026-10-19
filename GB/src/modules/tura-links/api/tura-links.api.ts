import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import type { TuraLink, TuraLinkCode } from '../types/tura-link.types';

export const turaLinksKeys = {
  all: ['tura-links'] as const,
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
