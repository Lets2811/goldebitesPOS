import {
  Order,
  OrderItem,
  OrderItemRow,
  OrderRow,
  OrderStatusHistoryEntry,
  OrderStatusHistoryRow,
} from '../domain/order.interface';

export class OrderMapper {
  static toDomain(row: OrderRow): Order {
    return {
      id: row.id,
      businessId: row.business_id,
      branchId: row.branch_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      createdBy: row.created_by,
      orderNumber: row.order_number,
      orderType: row.order_type,
      status: row.status,
      paymentStatus: row.payment_status,
      paymentPolicy: row.payment_policy,
      tableNumber: row.table_number,
      deliveryAddress: row.delivery_address,
      deliveryInstructions: row.delivery_instructions,
      subtotal: parseFloat(row.subtotal),
      discountAmount: parseFloat(row.discount_amount),
      taxAmount: parseFloat(row.tax_amount),
      deliveryFee: parseFloat(row.delivery_fee),
      totalAmount: parseFloat(row.total_amount),
      notes: row.notes,
      confirmedAt: row.confirmed_at,
      preparedAt: row.prepared_at,
      deliveredAt: row.delivered_at,
      cancelledAt: row.cancelled_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static itemToDomain(row: OrderItemRow): OrderItem {
    return {
      id: row.id,
      orderId: row.order_id,
      productId: row.product_id,
      productNameSnapshot: row.product_name_snapshot,
      productDescriptionSnapshot: row.product_description_snapshot,
      quantity: parseFloat(row.quantity),
      unitPrice: parseFloat(row.unit_price),
      unitCostSnapshot: parseFloat(row.unit_cost_snapshot),
      discountAmount: parseFloat(row.discount_amount),
      totalPrice: parseFloat(row.total_price),
      notes: row.notes,
      optionSelections: row.option_selections,
      createdAt: row.created_at,
    };
  }

  static historyToDomain(row: OrderStatusHistoryRow): OrderStatusHistoryEntry {
    return {
      id: row.id,
      orderId: row.order_id,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      changedBy: row.changed_by,
      notes: row.notes,
      createdAt: row.created_at,
    };
  }
}
