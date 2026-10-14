import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expenseCategoriesApi, expenseCategoryKeys } from '../api/expense-categories.api';
import type { UpdateExpenseCategoryPayload } from '../types/expense.types';

/**
 * Los tipos de gasto del negocio: una lista que cada negocio administra desde
 * Configuración. `labelOf` da el nombre de un tipo por su código, que es lo
 * que guarda cada gasto; sirve también para los tipos desactivados, porque sus
 * gastos antiguos siguen existiendo.
 */
export function useExpenseCategories() {
  const query = useQuery({
    queryKey: expenseCategoryKeys.all,
    queryFn: () => expenseCategoriesApi.getAll(),
    staleTime: 5 * 60_000,
  });

  const categories = useMemo(() => query.data ?? [], [query.data]);
  const active = useMemo(() => categories.filter((category) => category.isActive), [categories]);
  const labelOf = useCallback(
    (code: string) => categories.find((category) => category.code === code)?.name ?? code,
    [categories],
  );

  return { ...query, categories, active, labelOf };
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: expenseCategoryKeys.all });
}

export function useCreateExpenseCategory() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: expenseCategoriesApi.create, onSuccess: invalidate });
}

export function useUpdateExpenseCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateExpenseCategoryPayload }) =>
      expenseCategoriesApi.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteExpenseCategory() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: expenseCategoriesApi.remove, onSuccess: invalidate });
}
