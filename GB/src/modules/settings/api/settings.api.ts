import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';

export interface BusinessSettings {
  taxRate: number;
  discountsAtCheckout: boolean;
}

export const settingsApi = {
  async get(): Promise<BusinessSettings> {
    const { data } = await apiClient.get<ApiResponse<BusinessSettings>>('/settings');
    return data.data;
  },

  /** Changes only the settings sent. */
  async update(changes: Partial<BusinessSettings>): Promise<BusinessSettings> {
    const { data } = await apiClient.patch<ApiResponse<BusinessSettings>>('/settings', changes);
    return data.data;
  },
};
