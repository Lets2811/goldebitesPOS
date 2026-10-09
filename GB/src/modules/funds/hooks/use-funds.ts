import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fundKeys, fundsApi } from '../api/funds.api';
import type { FundType, InitializeFundPayload } from '../types/fund.types';

export function useFundBalance(fundType: FundType, branchId?: string, enabled = true) {
  return useQuery({
    queryKey: fundKeys.balance(fundType, branchId),
    queryFn: () => fundsApi.getBalance(fundType, branchId),
    enabled,
    staleTime: 30_000,
  });
}

export function useInitializeFund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fundType, payload }: { fundType: FundType; payload: InitializeFundPayload }) =>
      fundsApi.initialize(fundType, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fundKeys.all });
    },
  });
}
