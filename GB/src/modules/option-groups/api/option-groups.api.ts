import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import type {
  CreateOptionGroupPayload,
  CreateOptionItemPayload,
  OptionGroup,
  OptionItem,
  UpdateOptionGroupPayload,
  UpdateOptionItemPayload,
} from '../types/option-group.types';

export const optionGroupKeys = {
  all: ['option-groups'] as const,
};

export const optionGroupsApi = {
  async getAll(): Promise<OptionGroup[]> {
    const { data } = await apiClient.get<ApiResponse<OptionGroup[]>>('/option-groups');
    return data.data;
  },

  async createGroup(payload: CreateOptionGroupPayload): Promise<OptionGroup> {
    const { data } = await apiClient.post<ApiResponse<OptionGroup>>('/option-groups', payload);
    return data.data;
  },

  async updateGroup(id: string, payload: UpdateOptionGroupPayload): Promise<OptionGroup> {
    const { data } = await apiClient.patch<ApiResponse<OptionGroup>>(`/option-groups/${id}`, payload);
    return data.data;
  },

  async setOrder(groupIds: string[]): Promise<OptionGroup[]> {
    const { data } = await apiClient.put<ApiResponse<OptionGroup[]>>('/option-groups/order', { groupIds });
    return data.data;
  },

  async deleteGroup(id: string): Promise<void> {
    await apiClient.delete(`/option-groups/${id}`);
  },

  async createItem(groupId: string, payload: CreateOptionItemPayload): Promise<OptionItem> {
    const { data } = await apiClient.post<ApiResponse<OptionItem>>(`/option-groups/${groupId}/items`, payload);
    return data.data;
  },

  async updateItem(groupId: string, id: string, payload: UpdateOptionItemPayload): Promise<OptionItem> {
    const { data } = await apiClient.patch<ApiResponse<OptionItem>>(
      `/option-groups/${groupId}/items/${id}`,
      payload,
    );
    return data.data;
  },

  async deleteItem(groupId: string, id: string): Promise<void> {
    await apiClient.delete(`/option-groups/${groupId}/items/${id}`);
  },
};
