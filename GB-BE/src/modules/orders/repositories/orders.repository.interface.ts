import { DbClient } from '../../../database/types/database.types';
import {
  DailySalesRow,
  OrderItemRow,
  OrderRow,
  OrderStatus,
  OrderStatusHistoryRow,
  PaymentPolicy,
  SalesSummaryRow,
  TopProductRow,
  TopProductsOrder,
} from '../domain/order.interface';
import {
  CreateOrderData,
  OrderItemComputed,
  OrderQuery,
} from '../domain/order.types';

export interface IOrdersRepository {
  create(
    data: CreateOrderData,
    createdBy: string | undefined,
    timezone?: string,
    paymentPolicy?: PaymentPolicy,
    client?: DbClient,
  ): Promise<OrderRow>;
  findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<OrderRow | null>;
  findAll(query: OrderQuery): Promise<{ rows: OrderRow[]; total: number }>;
  findActiveForKitchen(
    businessId: string,
    branchId?: string,
  ): Promise<OrderRow[]>;
  /** The most recent non-DELIVERED/CANCELLED DINE_IN order for a table, or null if none — used by the public NFC ordering endpoint to decide create vs. addItems. */
  findActiveByTable(
    businessId: string,
    branchId: string,
    tableNumber: string,
  ): Promise<OrderRow | null>;
  /** Orders left open (not DELIVERED/CANCELLED) from before the business's current local calendar day. */
  findBacklog(
    businessId: string,
    timezone: string,
    branchId?: string,
  ): Promise<OrderRow[]>;
  addItems(
    orderId: string,
    items: OrderItemComputed[],
    client?: DbClient,
  ): Promise<void>;
  replaceItems(
    orderId: string,
    items: OrderItemComputed[],
    client?: DbClient,
  ): Promise<void>;
  findItems(orderId: string, client?: DbClient): Promise<OrderItemRow[]>;
  setDiscount(
    orderId: string,
    discount: {
      percent: number;
      discountId: string | null;
      source: string;
      label: string;
    } | null,
    client?: DbClient,
  ): Promise<void>;

  updateTotals(
    orderId: string,
    subtotal: number,
    discountAmount: number,
    taxAmount: number,
    deliveryFee: number,
    totalAmount: number,
    client?: DbClient,
  ): Promise<void>;
  setStatus(
    id: string,
    businessId: string,
    status: OrderStatus,
    timestampColumn: string | null,
    client?: DbClient,
  ): Promise<OrderRow | null>;
  updatePaymentStatus(
    id: string,
    paymentStatus: string,
    client?: DbClient,
  ): Promise<void>;
  getTotalPaid(orderId: string, client?: DbClient): Promise<number>;
  addStatusHistory(
    orderId: string,
    previousStatus: OrderStatus | null,
    newStatus: OrderStatus,
    changedBy: string | undefined,
    notes: string | undefined,
    client?: DbClient,
  ): Promise<OrderStatusHistoryRow>;
  findStatusHistory(orderId: string): Promise<OrderStatusHistoryRow[]>;
  getActiveCount(businessId: string, branchId?: string): Promise<number>;
  getSalesSummary(
    businessId: string,
    branchId: string | undefined,
    dateFrom: string,
    dateTo: string,
  ): Promise<SalesSummaryRow>;
  /** Days are the business's own: each sale falls on the calendar day it was paid in full, in `timezone`. */
  getSalesByDay(
    businessId: string,
    branchId: string | undefined,
    dateFrom: string,
    dateTo: string,
    timezone: string,
  ): Promise<DailySalesRow[]>;
  getTopProducts(
    businessId: string,
    branchId: string | undefined,
    dateFrom: string,
    dateTo: string,
    limit: number,
    orderBy?: TopProductsOrder,
  ): Promise<TopProductRow[]>;
}

export const ORDERS_REPOSITORY = Symbol('ORDERS_REPOSITORY');
