import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import type { PublicMenu } from '../types/public-menu.types';

export const publicMenuApi = {
  /** The branch's menu (without what it doesn't offer or ran out of); without a branch, the business's. */
  async getMenu(businessId: string, branchId?: string): Promise<PublicMenu> {
    const { data } = await apiClient.get<ApiResponse<PublicMenu>>(`/public/menu/${businessId}`, {
      params: branchId ? { branchId } : {},
    });
    return data.data;
  },
};
