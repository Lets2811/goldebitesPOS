import { adminApiClient as apiClient } from '../../../lib/admin-api-client';
import type { ApiResponse } from '../../../shared/lib/api/api-types';
import type { Branch } from '../../../shared/modules/branches/types/branch.types';
import type {
  BranchDetailsPayload,
  Business,
  BusinessUserSummary,
  CreatePlatformBusinessPayload,
  FeatureStatus,
  PlatformFeatureFlagStatus,
} from '../types/platform-admin.types';

export const platformAdminApi = {
  async getBusinesses(): Promise<Business[]> {
    const { data } = await apiClient.get<ApiResponse<Business[]>>('/businesses');
    return data.data;
  },

  async createBusiness(payload: CreatePlatformBusinessPayload): Promise<Business> {
    const { data } = await apiClient.post<ApiResponse<Business>>('/businesses', payload);
    return data.data;
  },

  async getFeatures(businessId: string): Promise<FeatureStatus[]> {
    const { data } = await apiClient.get<ApiResponse<FeatureStatus[]>>(
      `/businesses/${businessId}/features`,
    );
    return data.data;
  },

  async setFeature(businessId: string, featureKey: string, enabled: boolean): Promise<void> {
    await apiClient.put(`/businesses/${businessId}/features/${featureKey}`, { enabled });
  },

  async getUsers(businessId: string): Promise<BusinessUserSummary[]> {
    const { data } = await apiClient.get<ApiResponse<BusinessUserSummary[]>>(
      `/businesses/${businessId}/users`,
    );
    return data.data;
  },

  async resetUserPassword(businessId: string, userId: string): Promise<{ temporaryPassword: string }> {
    const { data } = await apiClient.post<ApiResponse<{ temporaryPassword: string }>>(
      `/businesses/${businessId}/users/${userId}/reset-password`,
    );
    return data.data;
  },

  async getBranches(businessId: string): Promise<Branch[]> {
    const { data } = await apiClient.get<ApiResponse<Branch[]>>(`/businesses/${businessId}/branches`);
    return data.data;
  },

  async createBranch(businessId: string, payload: BranchDetailsPayload & { name: string }): Promise<Branch> {
    const { data } = await apiClient.post<ApiResponse<Branch>>(
      `/businesses/${businessId}/branches`,
      payload,
    );
    return data.data;
  },

  async updateBranch(businessId: string, branchId: string, payload: BranchDetailsPayload): Promise<Branch> {
    const { data } = await apiClient.patch<ApiResponse<Branch>>(
      `/businesses/${businessId}/branches/${branchId}`,
      payload,
    );
    return data.data;
  },

  async setBranchStatus(businessId: string, branchId: string, isActive: boolean): Promise<Branch> {
    const { data } = await apiClient.patch<ApiResponse<Branch>>(
      `/businesses/${businessId}/branches/${branchId}/status`,
      { isActive },
    );
    return data.data;
  },

  async deleteBranch(businessId: string, branchId: string): Promise<void> {
    await apiClient.delete(`/businesses/${businessId}/branches/${branchId}`);
  },

  async getFeatureFlags(): Promise<PlatformFeatureFlagStatus[]> {
    const { data } = await apiClient.get<ApiResponse<PlatformFeatureFlagStatus[]>>('/feature-flags');
    return data.data;
  },

  async setFeatureFlag(featureKey: string, enabled: boolean): Promise<void> {
    await apiClient.put(`/feature-flags/${featureKey}`, { enabled });
  },
};
