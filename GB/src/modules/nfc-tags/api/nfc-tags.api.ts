import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import type { CreateNfcTagPayload, NfcTag, PublicNfcResolution, UpdateNfcTagPayload } from '../types/nfc-tag.types';

export const nfcTagsApi = {
  async getByBranch(branchId: string): Promise<NfcTag[]> {
    const { data } = await apiClient.get<ApiResponse<NfcTag[]>>('/nfc-tags', { params: { branchId } });
    return data.data;
  },

  async create(payload: CreateNfcTagPayload): Promise<NfcTag> {
    const { data } = await apiClient.post<ApiResponse<NfcTag>>('/nfc-tags', payload);
    return data.data;
  },

  async update(id: string, payload: UpdateNfcTagPayload): Promise<NfcTag> {
    const { data } = await apiClient.patch<ApiResponse<NfcTag>>(`/nfc-tags/${id}`, payload);
    return data.data;
  },

  async setStatus(id: string, isActive: boolean): Promise<NfcTag> {
    const { data } = await apiClient.patch<ApiResponse<NfcTag>>(`/nfc-tags/${id}/status`, { isActive });
    return data.data;
  },

  async setSelfService(id: string, enabled: boolean): Promise<NfcTag> {
    const { data } = await apiClient.patch<ApiResponse<NfcTag>>(`/nfc-tags/${id}/self-service`, { enabled });
    return data.data;
  },

  async regenerateToken(id: string): Promise<NfcTag> {
    const { data } = await apiClient.post<ApiResponse<NfcTag>>(`/nfc-tags/${id}/regenerate-token`);
    return data.data;
  },
};

export const publicNfcApi = {
  async resolve(token: string): Promise<PublicNfcResolution> {
    const { data } = await apiClient.get<ApiResponse<PublicNfcResolution>>(`/public/nfc/${token}`);
    return data.data;
  },
};
