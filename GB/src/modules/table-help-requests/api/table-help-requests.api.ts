import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';

/** Una mesa pidiendo ayuda del personal desde su menú NFC; pendiente hasta que alguien la atiende. */
export interface TableHelpRequest {
  id: string;
  businessId: string;
  branchId: string;
  tableNumber: string;
  createdAt: string;
  attendedAt: string | null;
}

export const tableHelpRequestKeys = {
  all: ['table-help-requests'] as const,
  pending: (branchId?: string | null) => [...tableHelpRequestKeys.all, 'pending', branchId ?? null] as const,
};

export const tableHelpRequestsApi = {
  async getPending(branchId?: string | null): Promise<TableHelpRequest[]> {
    const { data } = await apiClient.get<ApiResponse<TableHelpRequest[]>>('/table-help-requests', {
      params: { branchId: branchId ?? undefined },
    });
    return data.data;
  },

  async attend(id: string): Promise<TableHelpRequest> {
    const { data } = await apiClient.patch<ApiResponse<TableHelpRequest>>(`/table-help-requests/${id}/attend`);
    return data.data;
  },

  /** Público: lo llama el menú de la mesa. La mesa sale del token, nunca del cliente. */
  async requestFromTable(token: string): Promise<{ requestedAt: string }> {
    const { data } = await apiClient.post<ApiResponse<{ requestedAt: string }>>(`/public/nfc/${token}/help`);
    return data.data;
  },
};
