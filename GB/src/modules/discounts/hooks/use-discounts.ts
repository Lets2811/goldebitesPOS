import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orderKeys } from '../../orders/api/orders.keys';
import { discountKeys, discountsApi } from '../api/discounts.api';
import type { ApplyDiscountPayload, DiscountPayload } from '../types/discount.types';

export function useDiscounts() {
  return useQuery({ queryKey: discountKeys.all, queryFn: discountsApi.list });
}

/** Las promociones que se pueden aplicar ahora, para el desplegable al cobrar. */
export function useAvailablePromotions(enabled: boolean) {
  return useQuery({ queryKey: discountKeys.available, queryFn: discountsApi.available, enabled });
}

function useInvalidateDiscounts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: discountKeys.all });
}

export function useSaveDiscount() {
  const invalidate = useInvalidateDiscounts();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: DiscountPayload }) =>
      id ? discountsApi.update(id, payload) : discountsApi.create(payload),
    onSuccess: invalidate,
  });
}

export function useDeleteDiscount() {
  const invalidate = useInvalidateDiscounts();
  return useMutation({
    mutationFn: (id: string) => discountsApi.remove(id),
    onSuccess: invalidate,
  });
}

export function useApplyOrderDiscount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: ApplyDiscountPayload }) =>
      discountsApi.applyToOrder(orderId, payload),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(order.id) });
      // A coupon or promotion just used one of its uses.
      queryClient.invalidateQueries({ queryKey: discountKeys.all });
    },
  });
}
