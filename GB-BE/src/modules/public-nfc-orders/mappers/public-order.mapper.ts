import { OrderWithItems } from '../../orders/domain/order.interface';

export interface PublicOrderItemView {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  /** What was picked, per group: [{ groupName: "Salsas", itemNames: ["BBQ"] }]. */
  optionSelections: { groupName: string; itemNames: string[] }[];
  notes: string | null;
}

export interface PublicOrderView {
  id: string;
  orderNumber: string;
  status: string;
  orderType: string;
  tableNumber: string | null;
  items: PublicOrderItemView[];
  totalAmount: number;
  createdAt: Date;
}

/**
 * Trims an internal OrderWithItems down to what a customer-facing NFC screen
 * may see — no business/branch/customer ids, no payment status, and
 * critically no unitCostSnapshot (that would leak margin).
 */
export function toPublicOrderView(order: OrderWithItems): PublicOrderView {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    orderType: order.orderType,
    tableNumber: order.tableNumber,
    items: order.items.map((item) => ({
      productName: item.productNameSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      optionSelections: item.optionSelections.map(
        ({ groupName, itemNames }) => ({
          groupName,
          itemNames,
        }),
      ),
      notes: item.notes,
    })),
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
  };
}
