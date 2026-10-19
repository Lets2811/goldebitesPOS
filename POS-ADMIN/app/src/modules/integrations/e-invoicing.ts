import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse } from '../../shared/lib/api/api-types';
import type {
  EInvoicingSettings,
  EInvoicingSettingsPayload,
  NumberingRange,
} from '../../shared/modules/e-invoicing/types/e-invoicing.types';
import { adminApiClient } from '../../lib/admin-api-client';

/** A business's connection to its own Factus account (electronic invoicing), set up by the Golden Bites team. */
const keys = {
  settings: (businessId: string) => ['admin', 'e-invoicing', businessId] as const,
};

const api = {
  async settings(businessId: string): Promise<EInvoicingSettings> {
    const { data } = await adminApiClient.get<ApiResponse<EInvoicingSettings>>(`/businesses/${businessId}/e-invoicing`);
    return data.data;
  },
  async save(businessId: string, payload: EInvoicingSettingsPayload): Promise<EInvoicingSettings> {
    const { data } = await adminApiClient.put<ApiResponse<EInvoicingSettings>>(
      `/businesses/${businessId}/e-invoicing`,
      payload,
    );
    return data.data;
  },
  async test(businessId: string, payload: EInvoicingSettingsPayload): Promise<NumberingRange[]> {
    const { data } = await adminApiClient.post<ApiResponse<NumberingRange[]>>(
      `/businesses/${businessId}/e-invoicing/test`,
      payload,
      // Factus may take a while to answer.
      { timeout: 60_000 },
    );
    return data.data;
  },
};

export function useEInvoicingSettings(businessId: string | undefined) {
  return useQuery({
    queryKey: keys.settings(businessId ?? ''),
    queryFn: () => api.settings(businessId!),
    enabled: Boolean(businessId),
  });
}

export function useSaveEInvoicingSettings(businessId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EInvoicingSettingsPayload) => api.save(businessId, payload),
    onSuccess: (settings) => queryClient.setQueryData(keys.settings(businessId), settings),
  });
}

export function useTestEInvoicingConnection(businessId: string) {
  return useMutation({ mutationFn: (payload: EInvoicingSettingsPayload) => api.test(businessId, payload) });
}
