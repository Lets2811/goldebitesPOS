import { useQuery } from '@tanstack/react-query';
import { expensesApi } from '../api/expenses.api';
import { expenseKeys } from '../api/expenses.keys';

export function useExpenseDailyTotals(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: expenseKeys.daily(dateFrom, dateTo),
    queryFn: () => expensesApi.getDailyTotals(dateFrom, dateTo),
    staleTime: 30_000,
  });
}
