import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '../../auth/hooks/use-permissions';
import { eInvoicingApi, eInvoicingKeys } from '../api/e-invoicing.api';
import type { EInvoiceBuyer } from '../types/e-invoicing.types';

/**
 * Whether this business can issue electronic invoices: the add-on is on, the
 * user may issue them, and the platform connected the business's provider.
 */
export function useEInvoicingAvailable(): { available: boolean; sandbox: boolean } {
  const { hasFeature, hasPermission } = usePermissions();
  const enabled = hasFeature('einvoicing') && hasPermission('einvoices.issue');
  const { data } = useQuery({
    queryKey: eInvoicingKeys.status,
    queryFn: eInvoicingApi.status,
    enabled,
    staleTime: 5 * 60_000,
  });
  return { available: enabled && Boolean(data?.configured), sandbox: data?.environment === 'SANDBOX' };
}

export function useOrderEInvoice(orderId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: eInvoicingKeys.order(orderId ?? ''),
    queryFn: () => eInvoicingApi.forOrder(orderId!),
    enabled: enabled && Boolean(orderId),
  });
}

export function useIssueEInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, buyer }: { orderId: string; buyer: EInvoiceBuyer }) => eInvoicingApi.issue(orderId, buyer),
    onSuccess: (invoice) => queryClient.setQueryData(eInvoicingKeys.order(invoice.orderId), invoice),
    // A rejection is stored too (with its errors): show it.
    onError: (_error, { orderId }) => queryClient.invalidateQueries({ queryKey: eInvoicingKeys.order(orderId) }),
  });
}

/** Opens the invoice's official PDF in a new tab. */
export async function openEInvoicePdf(invoiceId: string): Promise<void> {
  const blob = await eInvoicingApi.pdf(invoiceId);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
