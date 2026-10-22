import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '../../config/env';
import { useAuthStore } from '../../modules/auth/store/auth.store';
import type { LoginResponseData } from '../../modules/auth/types/auth.types';
import { tokenStorage } from './token-storage';
import type { ApiResponse } from './api-types';

/** Endpoints that must never carry a Bearer token or trigger the refresh flow. */
const AUTH_EXCLUDED_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

function isAuthExcludedPath(url?: string): boolean {
  if (!url) return false;
  return AUTH_EXCLUDED_PATHS.some((path) => url.includes(path));
}

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken && !isAuthExcludedPath(config.url)) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

// Deduplicates concurrent refresh attempts: every 401 that arrives while a
// refresh is already in flight awaits the same promise instead of firing its
// own /auth/refresh call.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await axios.post<ApiResponse<LoginResponseData>>(
      `${env.apiBaseUrl}/auth/refresh`,
      { refreshToken },
    );
    const { accessToken, refreshToken: newRefreshToken, user } = response.data.data;
    tokenStorage.setRefreshToken(newRefreshToken);
    useAuthStore.getState().setSession({ user, accessToken });
    return accessToken;
  } catch {
    tokenStorage.clearRefreshToken();
    useAuthStore.getState().clearSession();
    return null;
  }
}

/**
 * The API gives the files it serves (product photos, logos) as paths on its
 * own server ("/api/v1/public/product-images/..."). The web app lives on that
 * same server; the phone app does not (it runs inside the phone, see
 * capacitor.config.ts), so there those paths get the API's server in front.
 */
const apiOrigin = /^https?:\/\//.test(env.apiBaseUrl) ? new URL(env.apiBaseUrl).origin : null;

function withApiOrigin(value: unknown): unknown {
  if (typeof value === 'string') return value.startsWith('/api/') ? apiOrigin + value : value;
  if (Array.isArray(value)) return value.map(withApiOrigin);
  // Plain JSON objects only: a downloaded file (Blob) is passed as it came.
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, withApiOrigin(entry)]),
    );
  }
  return value;
}

if (apiOrigin) {
  apiClient.interceptors.response.use((response) => {
    response.data = withApiOrigin(response.data);
    return response;
  });
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableRequestConfig | undefined;
    const status = error.response?.status;

    if (status !== 401 || !config || config._retry || isAuthExcludedPath(config.url)) {
      return Promise.reject(error);
    }

    config._retry = true;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newAccessToken = await refreshPromise;

    if (!newAccessToken) {
      return Promise.reject(error);
    }

    config.headers.set('Authorization', `Bearer ${newAccessToken}`);
    return apiClient(config);
  },
);
