import type { OptionSelection } from '../../option-groups/types/option-group.types';

export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'CAR_SERVICE';

export type OrderStatus =
  'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

export type OrderPaymentStatus = 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'REFUNDED' | 'CANCELLED';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  productNameSnapshot: string;
  productDescriptionSnapshot: string | null;
  quantity: number;
  unitPrice: number;
  unitCostSnapshot: number;
  discountAmount: number;
  totalPrice: number;
  notes: string | null;
  /** Lo elegido, por grupo de opciones, con los nombres de ese día. */
  optionSelections: OptionSelection[];
  createdAt: string;
}

export interface Order {
  id: string;
  businessId: string;
  branchId: string;
  customerId: string | null;
  customerName: string | null;
  createdBy: string | null;
  orderNumber: string;
  orderType: OrderType;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  tableNumber: string | null;
  deliveryAddress: string | null;
  deliveryInstructions: string | null;
  subtotal: number;
  discountAmount: number;
  /** El porcentaje del descuento (null: monto fijo, o sin descuento). */
  discountPercent: number | null;
  /** De dónde salió: MANUAL, PROMOTION o COUPON. */
  discountSource: 'MANUAL' | 'PROMOTION' | 'COUPON' | null;
  /** Cómo se lee en el pedido y la factura, p. ej. "Cupón VERANO10 (10%)". */
  discountLabel: string | null;
  taxAmount: number;
  deliveryFee: number;
  totalAmount: number;
  notes: string | null;
  confirmedAt: string | null;
  preparedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface CreateOrderItemPayload {
  productId: string;
  quantity: number;
  discountAmount?: number;
  notes?: string;
  /** Las opciones elegidas, de cualquiera de los grupos del producto. */
  optionItemIds?: string[];
}

export interface CreateOrderPayload {
  branchId: string;
  customerId?: string;
  customerName?: string;
  orderType: OrderType;
  tableNumber?: string;
  deliveryAddress?: string;
  deliveryInstructions?: string;
  discountAmount?: number;
  deliveryFee?: number;
  notes?: string;
  items: CreateOrderItemPayload[];
}

export interface OrderFilters {
  page?: number;
  limit?: number;
  branchId?: string;
  status?: OrderStatus;
  orderType?: OrderType;
  customerId?: string;
  createdBy?: string;
  dateFrom?: string;
  dateTo?: string;
}
