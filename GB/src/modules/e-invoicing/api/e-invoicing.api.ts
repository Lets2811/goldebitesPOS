import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import type {
  EInvoiceBuyer,
  EInvoicingStatus,
  ElectronicInvoice,
} from '../types/e-invoicing.types';

export const eInvoicingKeys = {
  status: ['e-invoicing', 'status'] as const,
  order: (orderId: string) => ['e-invoicing', 'order', orderId] as const,
};

export const eInvoicingApi = {
  async status(): Promise<EInvoicingStatus> {
    const { data } = await apiClient.get<ApiResponse<EInvoicingStatus>>('/e-invoicing/status');
    return data.data;
  },

  async forOrder(orderId: string): Promise<ElectronicInvoice | null> {
    const { data } = await apiClient.get<ApiResponse<ElectronicInvoice | null>>(`/orders/${orderId}/e-invoice`);
    return data.data ?? null;
  },

  async issue(orderId: string, buyer: EInvoiceBuyer): Promise<ElectronicInvoice> {
    // DIAN validation can take a while.
    const { data } = await apiClient.post<ApiResponse<ElectronicInvoice>>(
      `/orders/${orderId}/e-invoice`,
      { buyer },
      { timeout: 60_000 },
    );
    return data.data;
  },

  async pdf(invoiceId: string): Promise<Blob> {
    const { data } = await apiClient.get<Blob>(`/e-invoices/${invoiceId}/pdf`, { responseType: 'blob', timeout: 60_000 });
    return data;
  },
};
