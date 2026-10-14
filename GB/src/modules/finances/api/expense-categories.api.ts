import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import type {
  CreateExpenseCategoryPayload,
  ExpenseCategoryDefinition,
  UpdateExpenseCategoryPayload,
} from '../types/expense.types';

export const expenseCategoryKeys = {
  all: ['expense-categories'] as const,
};

export const expenseCategoriesApi = {
  async getAll(): Promise<ExpenseCategoryDefinition[]> {
    const { data } = await apiClient.get<ApiResponse<ExpenseCategoryDefinition[]>>('/expense-categories');
    return data.data;
  },

  async create(payload: CreateExpenseCategoryPayload): Promise<ExpenseCategoryDefinition> {
    const { data } = await apiClient.post<ApiResponse<ExpenseCategoryDefinition>>('/expense-categories', payload);
    return data.data;
  },

  async update(id: string, payload: UpdateExpenseCategoryPayload): Promise<ExpenseCategoryDefinition> {
    const { data } = await apiClient.patch<ApiResponse<ExpenseCategoryDefinition>>(
      `/expense-categories/${id}`,
      payload,
    );
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/expense-categories/${id}`);
  },
};
