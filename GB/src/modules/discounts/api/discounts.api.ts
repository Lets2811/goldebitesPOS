import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import type { Order } from '../../orders/types/order.types';
import type { ApplyDiscountPayload, Discount, DiscountPayload } from '../types/discount.types';

export const discountKeys = {
  all: ['discounts'] as const,
  available: ['discounts', 'available'] as const,
};

export const discountsApi = {
  async list(): Promise<Discount[]> {
    const { data } = await apiClient.get<ApiResponse<Discount[]>>('/discounts');
    return data.data;
  },

  async available(): Promise<Discount[]> {
    const { data } = await apiClient.get<ApiResponse<Discount[]>>('/discounts/available');
    return data.data;
  },

  async create(payload: DiscountPayload): Promise<Discount> {
    const { data } = await apiClient.post<ApiResponse<Discount>>('/discounts', payload);
    return data.data;
  },

  async update(id: string, payload: DiscountPayload): Promise<Discount> {
    const { data } = await apiClient.patch<ApiResponse<Discount>>(`/discounts/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/discounts/${id}`);
  },

  async applyToOrder(orderId: string, payload: ApplyDiscountPayload): Promise<Order> {
    const { data } = await apiClient.put<ApiResponse<Order>>(
      `/orders/${orderId}/discount`,
      payload,
    );
    return data.data;
  },
};
