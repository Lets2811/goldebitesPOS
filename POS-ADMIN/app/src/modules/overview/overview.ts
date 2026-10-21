import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ApiResponse } from '../../shared/lib/api/api-types';
import type { Branch } from '../../shared/modules/branches/types/branch.types';
import { adminApiClient } from '../../lib/admin-api-client';
import type { BusinessUserSummary, FeatureStatus } from '../businesses/types/platform-admin.types';

/** A business at a glance (GET businesses/overview; see PlatformOverviewService in GB-BE). */
export interface BusinessOverview {
  id: string;
  name: string;
  legalName: string | null;
  isActive: boolean;
  createdAt: string;
  hasLogo: boolean;
  currency: string;
  branches: { total: number; active: number };
  activeUsers: number;
  lastLoginAt: string | null;
  enabledModules: number;
  last30Days: { orders: number; sales: number };
  lastOrderAt: string | null;
  tura: { enabled: boolean; links: number };
  eInvoicing: {
    enabled: boolean;
    configured: boolean;
    environment: string | null;
    issued: number;
    failed: number;
    lastIssuedAt: string | null;
  };
}

/** Everything known about one business (GET businesses/:id/overview). */
export interface BusinessDetail extends BusinessOverview {
  taxId: string | null;
  email: string | null;
  phone: string | null;
  timezone: string;
  holdings: { products: number; activeProducts: number; inventoryItems: number; customers: number };
  sales: {
    today: { orders: number; sales: number };
    last7Days: { orders: number; sales: number };
    ordersAllTime: number;
    daily: { date: string; orders: number; sales: number }[];
  };
  modules: FeatureStatus[];
  branchList: Branch[];
  users: BusinessUserSummary[];
}

interface UsageGroup {
  key: string;
  turns: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

/** What TURA cost over a period (GET tura/usage; see summarizeUsage in TURA/api). */
export interface TuraUsage {
  days: number;
  currentModel: string;
  totals: {
    turns: number;
    errors: number;
    withTools: number;
    costUsd: number;
    costPerTurnUsd: number | null;
    projectedMonthlyUsd: number | null;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
  };
  latency: { firstTextMs: number | null; firstTextSlowMs: number | null; totalMs: number | null };
  byModel: UsageGroup[];
  byMode: UsageGroup[];
  byDay: UsageGroup[];
  /** Keyed by business id; "unknown" for turns recorded before the business was kept. */
  byBusiness?: UsageGroup[];
  whatIf: { model: string; price: { input: number; output: number } | null; costUsd: number | null }[];
  unpricedModels: string[];
  recent: {
    at: string;
    mode: string;
    outcome: 'ok' | 'error' | 'cancelled';
    model: string | null;
    tools: string[];
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    firstTextMs: number | null;
    totalMs: number;
  }[];
}

/** TURA's tools (GET tura/tools). */
export interface TuraTools {
  model: string;
  tools: { name: string; description: string; permission: string; kind: 'read' | 'write' }[];
}

export const overviewKeys = {
  businesses: ['admin', 'overview', 'businesses'] as const,
  business: (id: string) => ['admin', 'overview', 'business', id] as const,
  logo: (id: string) => ['admin', 'overview', 'logo', id] as const,
  usage: (days: number) => ['admin', 'tura', 'usage', days] as const,
  tools: ['admin', 'tura', 'tools'] as const,
};

const api = {
  async businesses(): Promise<BusinessOverview[]> {
    const { data } = await adminApiClient.get<ApiResponse<BusinessOverview[]>>('/businesses/overview');
    return data.data;
  },
  async business(id: string): Promise<BusinessDetail> {
    const { data } = await adminApiClient.get<ApiResponse<BusinessDetail>>(`/businesses/${id}/overview`);
    return data.data;
  },
  async logo(id: string): Promise<Blob> {
    const { data } = await adminApiClient.get<Blob>(`/businesses/${id}/logo`, { responseType: 'blob' });
    return data;
  },
  async usage(days: number): Promise<TuraUsage> {
    const { data } = await adminApiClient.get<ApiResponse<TuraUsage>>('/tura/usage', { params: { days } });
    return data.data;
  },
  async tools(): Promise<TuraTools> {
    const { data } = await adminApiClient.get<ApiResponse<TuraTools>>('/tura/tools');
    return data.data;
  },
};

export function useBusinessesOverview() {
  return useQuery({ queryKey: overviewKeys.businesses, queryFn: api.businesses });
}

export function useBusinessDetail(id: string) {
  return useQuery({ queryKey: overviewKeys.business(id), queryFn: () => api.business(id) });
}

/**
 * A business's logo as an address an <img> can show. The logo comes through
 * the Admin's API, which needs the session's token: an <img src> could not
 * send it, so the image is read here and handed over as a local object URL.
 */
export function useBusinessLogo(id: string, hasLogo: boolean): string | null {
  const { data } = useQuery({
    queryKey: overviewKeys.logo(id),
    queryFn: () => api.logo(id),
    enabled: hasLogo,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const url = useMemo(() => (data ? URL.createObjectURL(data) : null), [data]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

export function useTuraUsage(days: number) {
  return useQuery({ queryKey: overviewKeys.usage(days), queryFn: () => api.usage(days), retry: false });
}

export function useTuraTools() {
  return useQuery({ queryKey: overviewKeys.tools, queryFn: api.tools, retry: false, staleTime: 5 * 60_000 });
}
