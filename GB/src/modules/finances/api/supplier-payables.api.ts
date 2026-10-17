import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import type { SupplierPaymentInput } from '../types/expense.types';
import type {
  SupplierPayable,
  SupplierPayablesSummary,
  SupplierPayableWithPayments,
} from '../types/supplier-payable.types';

export const supplierPayableKeys = {
  all: ['supplier-payables'] as const,
  list: (filters: { supplierId?: string; openOnly?: boolean }) => [...supplierPayableKeys.all, 'list', filters] as const,
  detail: (id: string) => [...supplierPayableKeys.all, 'detail', id] as const,
  summary: () => [...supplierPayableKeys.all, 'summary'] as const,
};

export const supplierPayablesApi = {
  async getPayables(filters: { supplierId?: string; openOnly?: boolean }): Promise<SupplierPayable[]> {
    const { data } = await apiClient.get<ApiResponse<SupplierPayable[]>>('/supplier-payables', { params: filters });
    return data.data;
  },

  async getPayable(id: string): Promise<SupplierPayableWithPayments> {
    const { data } = await apiClient.get<ApiResponse<SupplierPayableWithPayments>>(`/supplier-payables/${id}`);
    return data.data;
  },

  async getSummary(): Promise<SupplierPayablesSummary> {
    const { data } = await apiClient.get<ApiResponse<SupplierPayablesSummary>>('/supplier-payables/summary');
    return data.data;
  },

  async recordPayment(id: string, payment: SupplierPaymentInput): Promise<SupplierPayableWithPayments> {
    const { data } = await apiClient.post<ApiResponse<SupplierPayableWithPayments>>(
      `/supplier-payables/${id}/payments`,
      payment,
    );
    return data.data;
  },
};
