import { OptionSelection } from '../../option-groups/domain/option-group.interface';
import { PaymentPolicy } from '../../branches/domain/branch.interface';

export { PaymentPolicy };

export enum OrderType {
  DINE_IN = 'DINE_IN',

  TAKEAWAY = 'TAKEAWAY',

  DELIVERY = 'DELIVERY',

  CAR_SERVICE = 'CAR_SERVICE',
}

export enum OrderStatus {
  PENDING = 'PENDING',

  CONFIRMED = 'CONFIRMED',

  PREPARING = 'PREPARING',

  READY = 'READY',

  DELIVERED = 'DELIVERED',

  CANCELLED = 'CANCELLED',
}

export enum OrderPaymentStatus {
  PENDING = 'PENDING',

  PAID = 'PAID',

  PARTIALLY_PAID = 'PARTIALLY_PAID',

  REFUNDED = 'REFUNDED',

  CANCELLED = 'CANCELLED',
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

  /** Copy of the branch's payment policy at the moment this order was created — see branches.payment_policy. Later branch changes never affect this. */

  paymentPolicy: PaymentPolicy;

  tableNumber: string | null;

  deliveryAddress: string | null;

  deliveryInstructions: string | null;

  subtotal: number;

  discountAmount: number;

  /** The percentage the discount is (null for a fixed amount, or none). */
  discountPercent: number | null;

  /** Where the discount came from: MANUAL, PROMOTION or COUPON (null: none, or a fixed amount). */
  discountSource: string | null;

  /** How the discount reads on the order and the receipt, e.g. "Cupón VERANO10 (10%)". */
  discountLabel: string | null;

  taxAmount: number;

  deliveryFee: number;

  totalAmount: number;

  notes: string | null;

  confirmedAt: Date | null;

  preparedAt: Date | null;

  deliveredAt: Date | null;

  cancelledAt: Date | null;

  createdAt: Date;

  updatedAt: Date;
}

export interface OrderRow {
  id: string;

  business_id: string;

  branch_id: string;

  customer_id: string | null;

  customer_name: string | null;

  created_by: string | null;

  order_number: string;

  order_type: OrderType;

  status: OrderStatus;

  payment_status: OrderPaymentStatus;

  payment_policy: PaymentPolicy;

  table_number: string | null;

  delivery_address: string | null;

  delivery_instructions: string | null;

  subtotal: string;

  discount_amount: string;

  discount_percent?: string | null;

  discount_id?: string | null;

  discount_source?: string | null;

  discount_label?: string | null;

  tax_amount: string;

  delivery_fee: string;

  total_amount: string;

  notes: string | null;

  confirmed_at: Date | null;

  prepared_at: Date | null;

  delivered_at: Date | null;

  cancelled_at: Date | null;

  created_at: Date;

  updated_at: Date;
}

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

  /** What was picked, per option group, with the names as they were that day. */

  optionSelections: OptionSelection[];

  createdAt: Date;
}

export interface OrderItemRow {
  id: string;

  order_id: string;

  product_id: string | null;

  product_name_snapshot: string;

  product_description_snapshot: string | null;

  quantity: string;

  unit_price: string;

  unit_cost_snapshot: string;

  discount_amount: string;

  total_price: string;

  notes: string | null;

  option_selections: OptionSelection[];

  created_at: Date;
}

export interface OrderStatusHistoryEntry {
  id: string;

  orderId: string;

  previousStatus: OrderStatus | null;

  newStatus: OrderStatus;

  changedBy: string | null;

  notes: string | null;

  createdAt: Date;
}

export interface OrderStatusHistoryRow {
  id: string;

  order_id: string;

  previous_status: OrderStatus | null;

  new_status: OrderStatus;

  changed_by: string | null;

  notes: string | null;

  created_at: Date;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface SalesSummary {
  orderCount: number;

  totalAmount: number;
}

export interface SalesSummaryRow {
  order_count: string;

  total_amount: string | null;
}

export interface DailySales {
  date: string;

  orderCount: number;

  totalAmount: number;
}

export interface DailySalesRow {
  date: string;

  order_count: string;

  total_amount: string;
}

export interface TopProduct {
  productId: string | null;

  productName: string;

  quantitySold: number;

  revenue: number;
}

/** What "best-selling" is measured by: the money a product brought in, or the units sold. */

export type TopProductsOrder = 'revenue' | 'quantity';

export interface TopProductRow {
  product_id: string | null;

  product_name: string;

  quantity_sold: string;

  revenue: string;
}
