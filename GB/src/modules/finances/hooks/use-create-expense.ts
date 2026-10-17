import { useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '../api/expenses.api';
import { expenseKeys } from '../api/expenses.keys';
import type { CreateExpensePayload } from '../types/expense.types';

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateExpensePayload) => expensesApi.createExpense(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      queryClient.invalidateQueries({ queryKey: ['funds'] });
      // Una compra a crédito abre una cuenta por pagar, y con un proveedor nuevo cambia la lista de proveedores.
      queryClient.invalidateQueries({ queryKey: ['supplier-payables'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
    },
  });
}
