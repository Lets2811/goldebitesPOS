import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import type {
  EInvoiceBuyer,
  EInvoicingSettings,
  EInvoicingSettingsPayload,
  EInvoicingStatus,
  ElectronicInvoice,
  NumberingRange,
} from '../types/e-invoicing.types';

export const eInvoicingKeys = {
  status: ['e-invoicing', 'status'] as const,
  order: (orderId: string) => ['e-invoicing', 'order', orderId] as const,
  settings: (businessId: string) => ['e-invoicing', 'settings', businessId] as const,
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

  // Platform admin: a business's connection to its Factus account.
  async settings(businessId: string): Promise<EInvoicingSettings> {
    const { data } = await apiClient.get<ApiResponse<EInvoicingSettings>>(`/platform-admin/businesses/${businessId}/e-invoicing`);
    return data.data;
  },

  async saveSettings(businessId: string, payload: EInvoicingSettingsPayload): Promise<EInvoicingSettings> {
    const { data } = await apiClient.put<ApiResponse<EInvoicingSettings>>(
      `/platform-admin/businesses/${businessId}/e-invoicing`,
      payload,
    );
    return data.data;
  },

  async testConnection(businessId: string, payload: EInvoicingSettingsPayload): Promise<NumberingRange[]> {
    const { data } = await apiClient.post<ApiResponse<NumberingRange[]>>(
      `/platform-admin/businesses/${businessId}/e-invoicing/test`,
      payload,
      { timeout: 60_000 },
    );
    return data.data;
  },
};
