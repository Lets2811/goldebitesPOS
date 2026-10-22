import { useMutation } from '@tanstack/react-query';
import type { ApiResponse } from '../shared/lib/api/api-types';
import { adminApiClient } from '../lib/admin-api-client';
import { useAdminAuthStore, type AdminSession } from './admin-auth.store';

export const adminAuthApi = {
  async login(email: string, password: string): Promise<AdminSession> {
    const { data } = await adminApiClient.post<ApiResponse<AdminSession>>('/auth/login', { email, password });
    return data.data;
  },

  async logout(refreshToken: string): Promise<void> {
    await adminApiClient.post('/auth/logout', { refreshToken });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<AdminSession> {
    const { data } = await adminApiClient.post<ApiResponse<AdminSession>>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return data.data;
  },
};

export function useAdminLogin() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => adminAuthApi.login(email, password),
    onSuccess: (session) => useAdminAuthStore.getState().setSession(session),
  });
}

export function useAdminChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      adminAuthApi.changePassword(currentPassword, newPassword),
    onSuccess: (session) => useAdminAuthStore.getState().setSession(session),
  });
}

/** Ends the session here and on the server (best-effort: the local one ends either way). */
export async function adminLogout(): Promise<void> {
  const { refreshToken, clearSession } = useAdminAuthStore.getState();
  clearSession();
  if (refreshToken) await adminAuthApi.logout(refreshToken).catch(() => {});
}
