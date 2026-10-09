import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import type { FundBalance, FundType, InitializeFundPayload } from '../types/fund.types';

export const fundKeys = {
  all: ['funds'] as const,
  balance: (fundType: FundType, branchId?: string) =>
    [...fundKeys.all, 'balance', fundType, branchId ?? null] as const,
};

export const fundsApi = {
  async getBalance(fundType: FundType, branchId?: string): Promise<FundBalance> {
    const { data } = await apiClient.get<ApiResponse<FundBalance>>('/funds', {
      // La cuenta bancaria es del negocio completo; solo la reserva es por sede.
      params: { fundType, branchId: fundType === 'CASH_RESERVE' ? branchId : undefined },
    });
    return data.data;
  },

  async initialize(fundType: FundType, payload: InitializeFundPayload): Promise<void> {
    if (fundType === 'CASH_RESERVE') {
      await apiClient.post('/funds/reserve/initialize', payload);
    } else {
      await apiClient.post('/funds/bank-account/initialize', {
        amount: payload.amount,
        notes: payload.notes,
      });
    }
  },
};
