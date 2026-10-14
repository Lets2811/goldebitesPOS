import type { ExpenseFilters } from '../types/expense.types';

export const expenseKeys = {
  all: ['expenses'] as const,
  lists: () => [...expenseKeys.all, 'list'] as const,
  list: (filters: ExpenseFilters) => [...expenseKeys.lists(), filters] as const,
  summary: (dateFrom: string, dateTo: string) => [...expenseKeys.all, 'summary', dateFrom, dateTo] as const,
  daily: (dateFrom: string, dateTo: string) => [...expenseKeys.all, 'daily', dateFrom, dateTo] as const,
};
