import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import type { CreateOtherIncomePayload, OtherIncome } from '../types/other-income.types';

export const otherIncomeKeys = {
  all: ['other-incomes'] as const,
  list: (dateFrom: string, dateTo: string) => [...otherIncomeKeys.all, dateFrom, dateTo] as const,
};

export const otherIncomesApi = {
  async getOtherIncomes(dateFrom: string, dateTo: string): Promise<OtherIncome[]> {
    const { data } = await apiClient.get<ApiResponse<OtherIncome[]>>('/other-incomes', {
      params: { dateFrom, dateTo },
    });
    return data.data;
  },

  async createOtherIncome(payload: CreateOtherIncomePayload): Promise<OtherIncome> {
    const { data } = await apiClient.post<ApiResponse<OtherIncome>>('/other-incomes', payload);
    return data.data;
  },

  async voidOtherIncome(id: string, reason: string): Promise<OtherIncome> {
    const { data } = await apiClient.patch<ApiResponse<OtherIncome>>(`/other-incomes/${id}/void`, { reason });
    return data.data;
  },
};
