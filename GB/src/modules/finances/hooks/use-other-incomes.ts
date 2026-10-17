import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { otherIncomeKeys, otherIncomesApi } from '../api/other-incomes.api';
import type { CreateOtherIncomePayload } from '../types/other-income.types';

export function useOtherIncomes(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: otherIncomeKeys.list(dateFrom, dateTo),
    queryFn: () => otherIncomesApi.getOtherIncomes(dateFrom, dateTo),
    staleTime: 30_000,
  });
}

/** Registrar o anular un ingreso mueve la caja o un fondo: se refrescan también. */
function useIncomeMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: otherIncomeKeys.all });
      queryClient.invalidateQueries({ queryKey: ['funds'] });
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
    },
  });
}

export function useCreateOtherIncome() {
  return useIncomeMutation((payload: CreateOtherIncomePayload) => otherIncomesApi.createOtherIncome(payload));
}

export function useVoidOtherIncome() {
  return useIncomeMutation(({ id, reason }: { id: string; reason: string }) =>
    otherIncomesApi.voidOtherIncome(id, reason),
  );
}
