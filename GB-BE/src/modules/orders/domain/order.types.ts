import { OptionSelection } from '../../option-groups/domain/option-group.interface';
import { OrderStatus, OrderType } from './order.interface';

export interface OrderItemInput {
  productId: string;
  quantity: number;
  discountAmount?: number;
  notes?: string;
  /** The options picked, from any of the product's groups. */
  optionItemIds?: string[];
  /** @deprecated Sent by clients from before option groups; read as optionItemIds. */
  sauceIds?: string[];
  /** @deprecated Sent by clients from before option groups; read as optionItemIds. */
  sideIds?: string[];
}

export interface CreateOrderData {
  businessId: string;
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
}

export interface OrderQuery {
  businessId: string;
  page: number;
  limit: number;
  branchId?: string;
  status?: OrderStatus;
  orderType?: OrderType;
  customerId?: string;
  createdBy?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface OrderItemComputed {
  productId: string;
  quantity: number;
  discountAmount?: number;
  notes?: string;
  productNameSnapshot: string;
  productDescriptionSnapshot: string | null;
  unitPrice: number;
  unitCostSnapshot: number;
  totalPrice: number;
  optionSelections: OptionSelection[];
}
