import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '../shared/config/env';
import type { ApiResponse } from '../shared/lib/api/api-types';
import { useAdminAuthStore, type AdminSession } from '../auth/admin-auth.store';

/** POS-ADMIN's API (POS-ADMIN/api): its own sign-in, and the bridge to the POS. */
const PLATFORM_BASE = env.apiBaseUrl;
const AUTH_EXCLUDED_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const isAuthExcluded = (url?: string) => Boolean(url && AUTH_EXCLUDED_PATHS.some((path) => url.includes(path)));

/**
 * POS-ADMIN's HTTP client: its own sessions (POS-ADMIN/api), refreshed on a
 * 401 against /auth/refresh, with the Admin's own session store.
 */
export const adminApiClient = axios.create({
  baseURL: PLATFORM_BASE,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

adminApiClient.interceptors.request.use((config) => {
  const { accessToken } = useAdminAuthStore.getState();
  if (accessToken && !isAuthExcluded(config.url)) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = useAdminAuthStore.getState();
  if (!refreshToken) return null;
  try {
    const response = await axios.post<ApiResponse<AdminSession>>(`${PLATFORM_BASE}/auth/refresh`, { refreshToken });
    useAdminAuthStore.getState().setSession(response.data.data);
    return response.data.data.accessToken;
  } catch {
    useAdminAuthStore.getState().clearSession();
    return null;
  }
}

adminApiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableRequestConfig | undefined;
    if (error.response?.status !== 401 || !config || config._retry || isAuthExcluded(config.url)) {
      return Promise.reject(error);
    }
    config._retry = true;
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const token = await refreshPromise;
    if (!token) return Promise.reject(error);
    config.headers.set('Authorization', `Bearer ${token}`);
    return adminApiClient(config);
  },
);
