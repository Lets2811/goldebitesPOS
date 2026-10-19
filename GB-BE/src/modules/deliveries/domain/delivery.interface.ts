import { BillingMode, DeliveryPricing, DistanceUnit } from './delivery-pricing';

export const DELIVERY_STATUSES = [
  'PENDING',
  'ASSIGNED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** The role a POS user has to have to be assigned deliveries. */
export const COURIER_ROLE = 'COURIER';

export interface DeliverySettingsRow {
  business_id: string;
  base_fee: string;
  price_per_unit: string;
  unit: DistanceUnit;
  unit_size: string;
  billing_mode: BillingMode;
  minimum_fee: string;
  rounding_step: string;
  updated_at: Date;
}

export interface DeliverySettings extends DeliveryPricing {
  /** False until the business saves its pricing; deliveries need it. */
  configured: boolean;
  updatedAt: Date | null;
}

export interface BranchLocationRow {
  branch_id: string;
  branch_name: string;
  branch_address: string | null;
  is_active: boolean;
  latitude: string | null;
  longitude: string | null;
}

/** A branch and where it is on the map (null until it is placed). */
export interface BranchLocation {
  branchId: string;
  branchName: string;
  branchAddress: string | null;
  isActive: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface CourierRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  branch_id: string | null;
}

export interface Courier {
  id: string;
  name: string;
  phone: string | null;
  branchId: string | null;
}

export interface LinkableOrderRow {
  id: string;
  order_number: string;
  order_type: string;
  status: string;
  branch_id: string;
  delivery_address: string | null;
  total_amount: string;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: Date;
}

/** An order a delivery can be linked to: not cancelled and without a live delivery. */
export interface LinkableOrder {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  branchId: string;
  deliveryAddress: string | null;
  totalAmount: number;
  customerName: string | null;
  customerPhone: string | null;
  createdAt: Date;
}

export interface DeliveryRow {
  id: string;
  business_id: string;
  branch_id: string;
  branch_name: string;
  order_id: string | null;
  order_number: string | null;
  courier_user_id: string | null;
  courier_first_name: string | null;
  courier_last_name: string | null;
  status: DeliveryStatus;
  tracking_code: string;
  origin_latitude: string;
  origin_longitude: string;
  destination_address: string;
  destination_details: string | null;
  destination_latitude: string;
  destination_longitude: string;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  distance_meters: number;
  duration_seconds: number | null;
  fee: string;
  pricing: DeliveryPricing;
  created_by: string | null;
  assigned_at: Date | null;
  picked_up_at: Date | null;
  delivered_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Delivery {
  id: string;
  branchId: string;
  branchName: string;
  orderId: string | null;
  orderNumber: string | null;
  courier: { id: string; name: string } | null;
  status: DeliveryStatus;
  /** What the customer opens the public tracking page with. */
  trackingCode: string;
  origin: LatLng;
  destination: LatLng & { address: string; details: string | null };
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  distanceMeters: number;
  durationSeconds: number | null;
  fee: number;
  pricing: DeliveryPricing;
  assignedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
}

export interface SaveSettingsData extends DeliveryPricing {
  updatedBy: string;
}

export interface CreateDeliveryData {
  businessId: string;
  branchId: string;
  orderId: string | null;
  courierUserId: string | null;
  status: DeliveryStatus;
  origin: LatLng;
  destination: LatLng & { address: string; details: string | null };
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  distanceMeters: number;
  durationSeconds: number | null;
  fee: number;
  pricing: DeliveryPricing;
  createdBy: string;
  trackingCode: string;
}

export interface DeliveryFilters {
  status?: DeliveryStatus;
  branchId?: string;
  courierUserId?: string;
  /** Inclusive range on created_at. */
  from?: Date;
  to?: Date;
}

/** The deliveries a courier sees in their app. */
export type CourierScope = 'active' | 'pending' | 'history';

export interface CourierBalance {
  from: Date;
  delivered: number;
  cancelled: number;
  fees: number;
  distanceMeters: number;
}

export interface CourierPosition extends LatLng {
  accuracyMeters: number | null;
  heading: number | null;
  speedMps: number | null;
}

export interface CourierLocationRow {
  user_id: string;
  first_name: string;
  last_name: string;
  latitude: string | null;
  longitude: string | null;
  accuracy_meters: number | null;
  recorded_at: Date | null;
}

export interface TrackPointRow {
  delivery_id: string;
  latitude: string;
  longitude: string;
  recorded_at: Date;
}

/** A courier on the admin's map: where they are and what they carry. */
export interface CourierTracking {
  courierId: string;
  name: string;
  location:
    (LatLng & { accuracyMeters: number | null; recordedAt: Date }) | null;
  deliveries: (Delivery & { trail: LatLng[] })[];
}

export const MESSAGE_SENDERS = ['CUSTOMER', 'COURIER', 'STAFF'] as const;
export type MessageSender = (typeof MESSAGE_SENDERS)[number];

export interface DeliveryMessageRow {
  id: string;
  delivery_id: string;
  sender: MessageSender;
  user_id: string | null;
  first_name: string | null;
  body: string;
  created_at: Date;
}

export interface DeliveryMessage {
  id: string;
  sender: MessageSender;
  /** First name of the courier or staff member; null for the customer. */
  senderName: string | null;
  body: string;
  createdAt: Date;
}

export interface PublicTrackingRow {
  id: string;
  status: DeliveryStatus;
  business_name: string;
  branch_name: string;
  origin_latitude: string;
  origin_longitude: string;
  destination_address: string;
  destination_latitude: string;
  destination_longitude: string;
  courier_user_id: string | null;
  courier_first_name: string | null;
  courier_last_name: string | null;
  fee: string;
  order_id: string | null;
  order_number: string | null;
  order_subtotal: string | null;
  order_discount: string | null;
  order_tax: string | null;
  order_delivery_fee: string | null;
  order_total: string | null;
  order_payment_status: string | null;
  courier_latitude: string | null;
  courier_longitude: string | null;
  courier_recorded_at: Date | null;
  created_at: Date;
  assigned_at: Date | null;
  picked_up_at: Date | null;
  delivered_at: Date | null;
  cancelled_at: Date | null;
  help_pending: boolean;
}

/** What the customer sees on the public page: their order and its costs; no phones, ids or business costs. */
export interface PublicTracking {
  code: string;
  status: DeliveryStatus;
  businessName: string;
  branchName: string;
  origin: LatLng;
  destination: LatLng & { address: string };
  courier: {
    name: string;
    location: (LatLng & { recordedAt: Date }) | null;
  } | null;
  createdAt: Date;
  assignedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  /** Whether the customer can still write in the chat. */
  chatOpen: boolean;
  /** The customer called the restaurant and no one has attended it yet. */
  helpPending: boolean;
  /** What the delivery costs. */
  fee: number;
  /** The order it carries, when the delivery is linked to one. */
  order: PublicOrderDetail | null;
}

export interface PublicOrderItemRow {
  product_name_snapshot: string;
  quantity: string;
  unit_price: string;
  total_price: string;
  notes: string | null;
  option_selections: { groupName: string; itemNames: string[] }[] | null;
}

export interface PublicOrderDetail {
  orderNumber: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    notes: string | null;
    /** "Salsas: BBQ, Ajo". */
    options: string[];
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  /** PENDING, PAID, PARTIALLY_PAID... */
  paymentStatus: string;
  /** Whether the order's total already carries a delivery charge of its own. */
  includesDeliveryFee: boolean;
  orderDeliveryFee: number;
}

export type HelpRequester = 'CUSTOMER' | 'COURIER';

export interface DeliveryHelpRequestRow {
  id: string;
  delivery_id: string;
  branch_id: string;
  requested_by: HelpRequester;
  reason: string | null;
  created_at: Date;
  tracking_code: string;
  status: DeliveryStatus;
  destination_address: string;
  customer_name: string | null;
  customer_phone: string | null;
  order_number: string | null;
  courier_first_name: string | null;
  courier_last_name: string | null;
}

/** A call for attention on a delivery, for the POS to sound and show. */
export interface DeliveryHelpRequest {
  id: string;
  deliveryId: string;
  branchId: string;
  requestedBy: HelpRequester;
  reason: string | null;
  createdAt: Date;
  delivery: {
    trackingCode: string;
    status: DeliveryStatus;
    address: string;
    customerName: string | null;
    customerPhone: string | null;
    orderNumber: string | null;
    courierName: string | null;
  };
}

export type CourierCaller = 'STAFF' | 'CUSTOMER';

export interface CourierCallRow {
  id: string;
  delivery_id: string;
  called_by: CourierCaller;
  staff_first_name: string | null;
  created_at: Date;
  tracking_code: string;
  destination_address: string;
  customer_name: string | null;
}

/** A call to the courier not marked seen yet: the courier app rings until it is. */
export interface CourierCall {
  id: string;
  deliveryId: string;
  calledBy: CourierCaller;
  /** Who called from the restaurant (first name); null when it was the customer. */
  staffName: string | null;
  createdAt: Date;
  delivery: {
    trackingCode: string;
    address: string;
    customerName: string | null;
  };
}
