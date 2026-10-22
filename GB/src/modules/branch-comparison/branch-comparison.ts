import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api/api-client';
import type { ApiResponse } from '../../lib/api/api-types';

export interface BranchFigures {
  branchId: string;
  name: string;
  isActive: boolean;
  orderCount: number;
  salesTotal: number;
  averageTicket: number;
  discountTotal: number;
  expenseTotal: number;
  wasteTotal: number;
  /** Right now, not in the range. */
  activeOrders: number;
  /** Right now, not in the range. */
  cashOpen: boolean;
}

export interface BranchComparison {
  branches: BranchFigures[];
  /** Sales per day, an amount per branch id. */
  daily: { date: string; sales: Record<string, number> }[];
}

export interface DateRange {
  dateFrom: string;
  dateTo: string;
}

export const branchComparisonApi = {
  async get(range: DateRange): Promise<BranchComparison> {
    const { data } = await apiClient.get<ApiResponse<BranchComparison>>('/branch-comparison', {
      params: range,
    });
    return data.data;
  },
};

export function useBranchComparison(range: DateRange, enabled = true) {
  return useQuery({
    queryKey: ['branch-comparison', range],
    queryFn: () => branchComparisonApi.get(range),
    enabled,
    refetchInterval: 60_000,
  });
}
