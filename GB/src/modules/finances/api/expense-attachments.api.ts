import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';

/** Un comprobante de una compra o gasto: la factura, la foto del tiquete, el soporte de la transferencia. */
export interface ExpenseAttachment {
  id: string;
  expenseId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export const ACCEPTED_ATTACHMENT_TYPES = 'application/pdf,image/jpeg,image/png,image/webp';
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** "850 KB" o "2,4 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`;
}

export const expenseAttachmentKeys = {
  list: (expenseId: string) => ['expense-attachments', expenseId] as const,
};

export const expenseAttachmentsApi = {
  async list(expenseId: string): Promise<ExpenseAttachment[]> {
    const { data } = await apiClient.get<ApiResponse<ExpenseAttachment[]>>(`/expenses/${expenseId}/attachments`);
    return data.data;
  },

  async upload(expenseId: string, file: File): Promise<ExpenseAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    // Sin esto la instancia manda 'application/json' y el backend no ve el archivo: el navegador
    // tiene que poner él mismo 'multipart/form-data; boundary=...' (igual que en document-scans).
    const { data } = await apiClient.post<ApiResponse<ExpenseAttachment>>(
      `/expenses/${expenseId}/attachments`,
      formData,
      { headers: { 'Content-Type': undefined } },
    );
    return data.data;
  },

  async remove(expenseId: string, id: string): Promise<void> {
    await apiClient.delete(`/expenses/${expenseId}/attachments/${id}`);
  },

  async getFileBlob(expenseId: string, id: string): Promise<Blob> {
    const { data } = await apiClient.get<Blob>(`/expenses/${expenseId}/attachments/${id}/file`, {
      responseType: 'blob',
    });
    return data;
  },
};
