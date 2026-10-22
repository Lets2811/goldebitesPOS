import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deliveriesApi, deliveriesKeys } from '../api/deliveries.api';
import type {
  CourierScope,
  CreateDeliveryPayload,
  DeliveryFilters,
  DeliveryPricing,
  DeliveryStatus,
  LatLng,
} from '../types/delivery.types';

export function useDeliveries(filters: DeliveryFilters) {
  return useQuery({
    queryKey: deliveriesKeys.list(filters),
    queryFn: () => deliveriesApi.list(filters),
    refetchInterval: 30_000,
  });
}

export function useDeliverySettings() {
  return useQuery({ queryKey: deliveriesKeys.settings, queryFn: deliveriesApi.settings });
}

export function useBranchLocations() {
  return useQuery({ queryKey: deliveriesKeys.branchLocations, queryFn: deliveriesApi.branchLocations });
}

export function useCouriers() {
  return useQuery({ queryKey: deliveriesKeys.couriers, queryFn: deliveriesApi.couriers });
}

export function useLinkableOrders(search: string, enabled: boolean) {
  return useQuery({
    queryKey: deliveriesKeys.linkableOrders(search),
    queryFn: () => deliveriesApi.linkableOrders(search),
    enabled,
  });
}

function useInvalidateDeliveries() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: deliveriesKeys.all });
}

export function useCreateDelivery() {
  const invalidate = useInvalidateDeliveries();
  return useMutation({
    mutationFn: (payload: CreateDeliveryPayload) => deliveriesApi.create(payload),
    onSuccess: invalidate,
  });
}

export function useAssignCourier() {
  const invalidate = useInvalidateDeliveries();
  return useMutation({
    mutationFn: ({ id, courierUserId }: { id: string; courierUserId: string | null }) =>
      deliveriesApi.assignCourier(id, courierUserId),
    onSuccess: invalidate,
  });
}

export function useChangeDeliveryStatus() {
  const invalidate = useInvalidateDeliveries();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: DeliveryStatus }) => deliveriesApi.changeStatus(id, status),
    onSuccess: invalidate,
  });
}

export function useSaveDeliverySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pricing: DeliveryPricing) => deliveriesApi.saveSettings(pricing),
    onSuccess: (settings) => queryClient.setQueryData(deliveriesKeys.settings, settings),
  });
}

export function useSetBranchLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, location }: { branchId: string; location: LatLng }) =>
      deliveriesApi.setBranchLocation(branchId, location),
    onSuccess: (locations) => queryClient.setQueryData(deliveriesKeys.branchLocations, locations),
  });
}

export function useCourierTracking(enabled: boolean) {
  return useQuery({
    queryKey: deliveriesKeys.tracking,
    queryFn: deliveriesApi.tracking,
    enabled,
    refetchInterval: 10_000,
  });
}

/** The courier's own deliveries; refreshed often, since new ones get assigned from the POS. */
export function useMyDeliveries(scope: CourierScope, from?: string) {
  return useQuery({
    queryKey: deliveriesKeys.mine(scope, from),
    queryFn: () => deliveriesApi.mine(scope, from),
    refetchInterval: scope === 'history' ? false : 15_000,
  });
}

export function useMyBalance(from: string) {
  return useQuery({ queryKey: deliveriesKeys.balance(from), queryFn: () => deliveriesApi.balance(from) });
}

export function useAdvanceOwnDelivery() {
  const invalidate = useInvalidateDeliveries();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'IN_TRANSIT' | 'DELIVERED' }) =>
      deliveriesApi.advanceOwn(id, status),
    onSuccess: invalidate,
  });
}

export function usePublicTracking(code: string) {
  return useQuery({
    queryKey: deliveriesKeys.public(code),
    queryFn: () => deliveriesApi.publicTracking(code),
    enabled: code !== '',
    retry: false,
    refetchInterval: (query) => (query.state.status === 'error' ? false : 10_000),
  });
}

/**
 * Deliveries whose customer or courier called the restaurant. Asked often and
 * also in the background: the alert has to sound on whatever screen is open.
 */
export function useDeliveryHelpRequests(enabled: boolean) {
  return useQuery({
    queryKey: deliveriesKeys.helpRequests,
    queryFn: deliveriesApi.helpRequests,
    enabled,
    staleTime: 0,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  });
}

export function useAttendDeliveryHelpRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deliveriesApi.attendHelpRequest(id),
    // Also on failure: most likely a colleague attended it first.
    onSettled: () => queryClient.invalidateQueries({ queryKey: deliveriesKeys.helpRequests }),
  });
}

export function useCallRestaurantAsCustomer(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => deliveriesApi.callRestaurantAsCustomer(code, reason),
    onSuccess: (tracking) => queryClient.setQueryData(deliveriesKeys.public(code), tracking),
  });
}

export function useCallRestaurantAsCourier() {
  return useMutation({
    mutationFn: ({ deliveryId, reason }: { deliveryId: string; reason?: string }) =>
      deliveriesApi.callRestaurantAsCourier(deliveryId, reason),
  });
}

export function useLinkDeliveryOrder() {
  const invalidate = useInvalidateDeliveries();
  return useMutation({
    mutationFn: ({ id, orderId }: { id: string; orderId: string | null }) => deliveriesApi.linkOrder(id, orderId),
    onSuccess: invalidate,
  });
}

/** Calls to this courier not seen yet: asked often, also in the background, so the app rings right away. */
export function useMyCourierCalls() {
  return useQuery({
    queryKey: deliveriesKeys.myCalls,
    queryFn: deliveriesApi.myCalls,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });
}

export function useMarkCourierCallsSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deliveryId: string) => deliveriesApi.markCallsSeen(deliveryId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: deliveriesKeys.myCalls }),
  });
}

export function useCallCourierAsStaff() {
  return useMutation({ mutationFn: (deliveryId: string) => deliveriesApi.callCourierAsStaff(deliveryId) });
}

export function useCallCourierAsCustomer(code: string) {
  return useMutation({ mutationFn: () => deliveriesApi.callCourierAsCustomer(code) });
}
