import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supplierPayableKeys, supplierPayablesApi } from '../api/supplier-payables.api';
import { expenseKeys } from '../api/expenses.keys';
import type { SupplierPaymentInput } from '../types/expense.types';

export function useSupplierPayables(filters: { supplierId?: string; openOnly?: boolean } = {}) {
  return useQuery({
    queryKey: supplierPayableKeys.list(filters),
    queryFn: () => supplierPayablesApi.getPayables(filters),
    staleTime: 15_000,
  });
}

export function useSupplierPayable(id: string | null) {
  return useQuery({
    queryKey: supplierPayableKeys.detail(id ?? ''),
    queryFn: () => supplierPayablesApi.getPayable(id as string),
    enabled: Boolean(id),
  });
}

export function useSupplierPayablesSummary(enabled = true) {
  return useQuery({
    queryKey: supplierPayableKeys.summary(),
    queryFn: () => supplierPayablesApi.getSummary(),
    staleTime: 30_000,
    enabled,
  });
}

/** Un pago a proveedor mueve una fuente y cuenta como gasto en su fecha: se refresca todo lo que lo muestra. */
export function useRecordSupplierPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payment }: { id: string; payment: SupplierPaymentInput }) =>
      supplierPayablesApi.recordPayment(id, payment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supplierPayableKeys.all });
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      queryClient.invalidateQueries({ queryKey: ['funds'] });
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
    },
  });
}
