import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import type {
  ChangePasswordPayload,
  CurrentUserProfile,
  LoginPayload,
  LoginResponseData,
} from '../types/auth.types';

export const authApi = {
  async login(payload: LoginPayload): Promise<LoginResponseData> {
    const { data } = await apiClient.post<ApiResponse<LoginResponseData>>('/auth/login', payload);
    return data.data;
  },

  async logout(refreshToken: string): Promise<void> {
    await apiClient.post('/auth/logout', { refreshToken });
  },

  /** Takes the session to one branch, or all of them (null); see useSwitchBranch. */
  async switchBranch(branchId: string | null, refreshToken?: string): Promise<LoginResponseData> {
    const { data } = await apiClient.post<ApiResponse<LoginResponseData>>('/auth/switch-branch', {
      branchId,
      refreshToken,
    });
    return data.data;
  },

  async getCurrentUser(): Promise<CurrentUserProfile> {
    const { data } = await apiClient.get<ApiResponse<CurrentUserProfile>>('/users/me');
    return data.data;
  },

  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    await apiClient.post('/auth/change-password', payload);
  },
};
