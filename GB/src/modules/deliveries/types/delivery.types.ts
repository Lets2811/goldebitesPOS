export type DistanceUnit = 'KM' | 'M';
export type BillingMode = 'PROPORTIONAL' | 'FULL_UNITS';
export type DeliveryStatus = 'PENDING' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export interface DeliveryPricing {
  baseFee: number;
  pricePerUnit: number;
  unit: DistanceUnit;
  /** How much distance one unit is, in `unit`: 1 km, 500 m... */
  unitSize: number;
  billingMode: BillingMode;
  minimumFee: number;
  /** Rounded up to a multiple of this; 0 for none. */
  roundingStep: number;
}

export interface DeliverySettings extends DeliveryPricing {
  configured: boolean;
  updatedAt: string | null;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface BranchLocation {
  branchId: string;
  branchName: string;
  branchAddress: string | null;
  isActive: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface Courier {
  id: string;
  name: string;
  phone: string | null;
  branchId: string | null;
}

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
  createdAt: string;
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
  assignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface CreateDeliveryPayload {
  branchId: string;
  orderId?: string | null;
  courierUserId?: string | null;
  origin: LatLng;
  destination: LatLng & { address: string; details?: string | null };
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  distanceMeters: number;
  durationSeconds?: number | null;
}

export interface DeliveryFilters {
  status?: DeliveryStatus;
  branchId?: string;
  from?: string;
  to?: string;
}

export type CourierScope = 'active' | 'pending' | 'history';

export interface CourierBalance {
  from: string;
  delivered: number;
  cancelled: number;
  fees: number;
  distanceMeters: number;
}

export interface CourierPosition extends LatLng {
  accuracyMeters?: number | null;
  heading?: number | null;
  speedMps?: number | null;
}

export interface CourierTracking {
  courierId: string;
  name: string;
  location: (LatLng & { accuracyMeters: number | null; recordedAt: string }) | null;
  deliveries: (Delivery & { trail: LatLng[] })[];
}

export type MessageSender = 'CUSTOMER' | 'COURIER' | 'STAFF';

export interface DeliveryMessage {
  id: string;
  sender: MessageSender;
  senderName: string | null;
  body: string;
  createdAt: string;
}

export interface PublicTracking {
  code: string;
  status: DeliveryStatus;
  businessName: string;
  branchName: string;
  origin: LatLng;
  destination: LatLng & { address: string };
  courier: { name: string; location: (LatLng & { recordedAt: string }) | null } | null;
  createdAt: string;
  assignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  chatOpen: boolean;
  /** The customer called the restaurant and no one has attended it yet. */
  helpPending: boolean;
  /** What the delivery costs. */
  fee: number;
  /** The order it carries, when the delivery is linked to one. */
  order: PublicOrderDetail | null;
}

export interface PublicOrderDetail {
  orderNumber: string;
  items: { name: string; quantity: number; unitPrice: number; total: number; notes: string | null; options: string[] }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentStatus: string;
  /** The order's total already carries a delivery charge of its own. */
  includesDeliveryFee: boolean;
  orderDeliveryFee: number;
}

export type HelpRequester = 'CUSTOMER' | 'COURIER';

export interface DeliveryHelpRequest {
  id: string;
  deliveryId: string;
  branchId: string;
  requestedBy: HelpRequester;
  reason: string | null;
  createdAt: string;
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

export interface CourierCall {
  id: string;
  deliveryId: string;
  calledBy: 'STAFF' | 'CUSTOMER';
  staffName: string | null;
  createdAt: string;
  delivery: { trackingCode: string; address: string; customerName: string | null };
}

export interface CallCourierResult {
  /** False when the same side called seconds ago and the courier has not seen it yet. */
  called: boolean;
  /** Phones that received the push; 0 means only the open app will ring. */
  devices: number;
}

/** A point read from a shared location (WhatsApp, Maps, Waze, coordinates). */
export interface SharedLocation extends LatLng {
  /** The place's name, when the link carried one. */
  label: string | null;
}
