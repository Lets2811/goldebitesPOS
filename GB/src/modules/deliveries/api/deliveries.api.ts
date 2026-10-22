import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import type {
  BranchLocation,
  Courier,
  CourierBalance,
  CourierPosition,
  CourierScope,
  CourierTracking,
  CallCourierResult,
  CourierCall,
  DeliveryHelpRequest,
  DeliveryMessage,
  PublicTracking,
  SharedLocation,
  CreateDeliveryPayload,
  Delivery,
  DeliveryFilters,
  DeliveryPricing,
  DeliverySettings,
  DeliveryStatus,
  LatLng,
  LinkableOrder,
} from '../types/delivery.types';

export const deliveriesKeys = {
  all: ['deliveries'] as const,
  list: (filters: DeliveryFilters) => ['deliveries', 'list', filters] as const,
  settings: ['deliveries', 'settings'] as const,
  branchLocations: ['deliveries', 'branch-locations'] as const,
  couriers: ['deliveries', 'couriers'] as const,
  linkableOrders: (search: string) => ['deliveries', 'linkable-orders', search] as const,
  tracking: ['deliveries', 'tracking'] as const,
  mine: (scope: CourierScope, from?: string) => ['deliveries', 'mine', scope, from ?? ''] as const,
  balance: (from: string) => ['deliveries', 'mine', 'balance', from] as const,
  public: (code: string) => ['public-delivery', code] as const,
  helpRequests: ['deliveries', 'help-requests'] as const,
  myCalls: ['deliveries', 'mine', 'calls'] as const,
};

/** Whose chat a component talks to: staff (any delivery), the courier (their own), or the customer (by code). */
export type ChatChannel =
  | { as: 'STAFF'; deliveryId: string }
  | { as: 'COURIER'; deliveryId: string }
  | { as: 'CUSTOMER'; code: string };

const chatPath = (channel: ChatChannel) =>
  channel.as === 'CUSTOMER'
    ? `/public/deliveries/${encodeURIComponent(channel.code)}/messages`
    : channel.as === 'COURIER'
      ? `/deliveries/mine/${channel.deliveryId}/messages`
      : `/deliveries/${channel.deliveryId}/messages`;

export const deliveriesApi = {
  async list(filters: DeliveryFilters): Promise<Delivery[]> {
    const { data } = await apiClient.get<ApiResponse<Delivery[]>>('/deliveries', { params: filters });
    return data.data;
  },

  async create(payload: CreateDeliveryPayload): Promise<Delivery> {
    const { data } = await apiClient.post<ApiResponse<Delivery>>('/deliveries', payload);
    return data.data;
  },

  async resolveLocation(text: string): Promise<SharedLocation> {
    const { data } = await apiClient.post<ApiResponse<SharedLocation>>('/deliveries/resolve-location', { text });
    return data.data;
  },

  async linkOrder(id: string, orderId: string | null): Promise<Delivery> {
    const { data } = await apiClient.patch<ApiResponse<Delivery>>(`/deliveries/${id}/order`, { orderId });
    return data.data;
  },

  async assignCourier(id: string, courierUserId: string | null): Promise<Delivery> {
    const { data } = await apiClient.patch<ApiResponse<Delivery>>(`/deliveries/${id}/courier`, { courierUserId });
    return data.data;
  },

  async changeStatus(id: string, status: DeliveryStatus): Promise<Delivery> {
    const { data } = await apiClient.patch<ApiResponse<Delivery>>(`/deliveries/${id}/status`, { status });
    return data.data;
  },

  async settings(): Promise<DeliverySettings> {
    const { data } = await apiClient.get<ApiResponse<DeliverySettings>>('/deliveries/settings');
    return data.data;
  },

  async saveSettings(pricing: DeliveryPricing): Promise<DeliverySettings> {
    const { data } = await apiClient.put<ApiResponse<DeliverySettings>>('/deliveries/settings', pricing);
    return data.data;
  },

  async branchLocations(): Promise<BranchLocation[]> {
    const { data } = await apiClient.get<ApiResponse<BranchLocation[]>>('/deliveries/branch-locations');
    return data.data;
  },

  async setBranchLocation(branchId: string, location: LatLng): Promise<BranchLocation[]> {
    const { data } = await apiClient.put<ApiResponse<BranchLocation[]>>(
      `/deliveries/branch-locations/${branchId}`,
      location,
    );
    return data.data;
  },

  async couriers(): Promise<Courier[]> {
    const { data } = await apiClient.get<ApiResponse<Courier[]>>('/deliveries/couriers');
    return data.data;
  },

  async tracking(): Promise<CourierTracking[]> {
    const { data } = await apiClient.get<ApiResponse<CourierTracking[]>>('/deliveries/tracking');
    return data.data;
  },

  async mine(scope: CourierScope, from?: string): Promise<Delivery[]> {
    const { data } = await apiClient.get<ApiResponse<Delivery[]>>('/deliveries/mine', {
      params: from ? { scope, from } : { scope },
    });
    return data.data;
  },

  async balance(from: string): Promise<CourierBalance> {
    const { data } = await apiClient.get<ApiResponse<CourierBalance>>('/deliveries/mine/balance', {
      params: { from },
    });
    return data.data;
  },

  async reportPosition(position: CourierPosition): Promise<void> {
    await apiClient.post('/deliveries/mine/position', position);
  },

  async advanceOwn(id: string, status: 'IN_TRANSIT' | 'DELIVERED'): Promise<Delivery> {
    const { data } = await apiClient.patch<ApiResponse<Delivery>>(`/deliveries/mine/${id}/status`, { status });
    return data.data;
  },

  async messages(channel: ChatChannel, after?: string): Promise<DeliveryMessage[]> {
    const { data } = await apiClient.get<ApiResponse<DeliveryMessage[]>>(chatPath(channel), {
      params: after ? { after } : {},
    });
    return data.data;
  },

  async sendMessage(channel: ChatChannel, body: string): Promise<DeliveryMessage> {
    const { data } = await apiClient.post<ApiResponse<DeliveryMessage>>(chatPath(channel), { body });
    return data.data;
  },

  async publicTracking(code: string): Promise<PublicTracking> {
    const { data } = await apiClient.get<ApiResponse<PublicTracking>>(
      `/public/deliveries/${encodeURIComponent(code)}`,
    );
    return data.data;
  },

  async callRestaurantAsCustomer(code: string, reason?: string): Promise<PublicTracking> {
    const { data } = await apiClient.post<ApiResponse<PublicTracking>>(
      `/public/deliveries/${encodeURIComponent(code)}/help`,
      reason ? { reason } : {},
    );
    return data.data;
  },

  async callRestaurantAsCourier(deliveryId: string, reason?: string): Promise<void> {
    await apiClient.post(`/deliveries/mine/${deliveryId}/help`, reason ? { reason } : {});
  },

  async myCalls(): Promise<CourierCall[]> {
    const { data } = await apiClient.get<ApiResponse<CourierCall[]>>('/deliveries/mine/calls');
    return data.data;
  },

  async markCallsSeen(deliveryId: string): Promise<void> {
    await apiClient.patch(`/deliveries/mine/${deliveryId}/calls/seen`);
  },

  async callCourierAsStaff(deliveryId: string): Promise<CallCourierResult> {
    const { data } = await apiClient.post<ApiResponse<CallCourierResult>>(`/deliveries/${deliveryId}/call-courier`);
    return data.data;
  },

  async callCourierAsCustomer(code: string): Promise<CallCourierResult> {
    const { data } = await apiClient.post<ApiResponse<CallCourierResult>>(
      `/public/deliveries/${encodeURIComponent(code)}/call-courier`,
    );
    return data.data;
  },

  async helpRequests(): Promise<DeliveryHelpRequest[]> {
    const { data } = await apiClient.get<ApiResponse<DeliveryHelpRequest[]>>('/deliveries/help-requests');
    return data.data;
  },

  async attendHelpRequest(id: string): Promise<void> {
    await apiClient.patch(`/deliveries/help-requests/${id}/attend`);
  },

  async linkableOrders(search: string): Promise<LinkableOrder[]> {
    const { data } = await apiClient.get<ApiResponse<LinkableOrder[]>>('/deliveries/linkable-orders', {
      params: search ? { search } : {},
    });
    return data.data;
  },
};
