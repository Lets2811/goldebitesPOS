import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleException,
  EntityNotFoundException,
  InvalidOrderStatusTransitionException,
} from '../../../common/exceptions';
import { PaginatedResult } from '../../../common/pagination/paginated-result.interface';
import { buildPaginationMeta } from '../../../common/pagination/pagination.util';
import { DbClient } from '../../../database/types/database.types';
import { TransactionService } from '../../../database/transaction.service';
import { AuditService } from '../../audit/services/audit.service';
import { BranchesService } from '../../branches/services/branches.service';
import { BusinessesService } from '../../businesses/services/businesses.service';
import { CustomersService } from '../../customers/services/customers.service';
import { InventoryMovementType } from '../../inventory-movements/domain/inventory-movement.types';
import { InventoryMovementsService } from '../../inventory-movements/services/inventory-movements.service';
import { LoyaltyService } from '../../loyalty/services/loyalty.service';
import { ProductsService } from '../../products/services/products.service';
import { BranchMenuService } from '../../products/services/branch-menu.service';
import { RecipesService } from '../../recipes/services/recipes.service';
import { OptionGroupsService } from '../../option-groups/services/option-groups.service';
import { resolveOptionSelections } from '../../option-groups/domain/resolve-option-selections';
import {
  DailySales,
  Order,
  OrderPaymentStatus,
  OrderRow,
  OrderStatus,
  OrderWithItems,
  PaymentPolicy,
  SalesSummary,
  TopProduct,
  TopProductsOrder,
  MostOrdered,
} from '../domain/order.interface';
import {
  CreateOrderData,
  OrderItemComputed,
  OrderItemInput,
  OrderQuery,
} from '../domain/order.types';
import { OrderMapper } from '../mappers/order.mapper';
import {
  CheckoutDiscountChoice,
  DiscountsService,
} from '../../discounts/discounts.service';
import { discountAmountFor } from '../../discounts/domain/discount';
import { ORDERS_REPOSITORY } from '../repositories/orders.repository.interface';
import type { IOrdersRepository } from '../repositories/orders.repository.interface';

/** Target status -> the order column that records when it was reached (null = no dedicated column). */
const STATUS_TIMESTAMP_COLUMN: Record<OrderStatus, string | null> = {
  [OrderStatus.PENDING]: null,
  [OrderStatus.CONFIRMED]: 'confirmed_at',
  [OrderStatus.PREPARING]: null,
  [OrderStatus.READY]: 'prepared_at',
  [OrderStatus.DELIVERED]: 'delivered_at',
  [OrderStatus.CANCELLED]: 'cancelled_at',
};

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class OrdersService {
  constructor(
    @Inject(ORDERS_REPOSITORY)
    private readonly ordersRepository: IOrdersRepository,
    private readonly branchesService: BranchesService,
    private readonly productsService: ProductsService,
    private readonly recipesService: RecipesService,
    private readonly customersService: CustomersService,
    private readonly movementsService: InventoryMovementsService,
    private readonly businessesService: BusinessesService,
    private readonly loyaltyService: LoyaltyService,
    private readonly optionGroupsService: OptionGroupsService,
    private readonly transactionService: TransactionService,
    private readonly auditService: AuditService,
    private readonly discountsService: DiscountsService,
    private readonly branchMenuService: BranchMenuService,
  ) {}

  async create(
    data: CreateOrderData,
    items: OrderItemInput[],
    actorUserId?: string,
  ): Promise<OrderWithItems> {
    if (items.length === 0) {
      throw new BusinessRuleException(
        'An order must include at least one item',
        'ORDER_EMPTY',
      );
    }

    const branch = await this.branchesService.findOne(
      data.businessId,
      data.branchId,
    );
    if (data.customerId) {
      await this.customersService.getOwnedOrFail(
        data.businessId,
        data.customerId,
      );
    }

    const computedItems = await this.computeItems(
      data.businessId,
      data.branchId,
      items,
      'all',
    );
    const taxRate = await this.businessesService.getTaxRate(data.businessId);
    const timezone = await this.businessesService.getTimezone(data.businessId);
    const totals = this.computeTotals(
      computedItems,
      data.discountAmount ?? 0,
      data.deliveryFee ?? 0,
      taxRate,
    );

    const row = await this.transactionService.execute(async (client) => {
      const created = await this.ordersRepository.create(
        data,
        actorUserId,
        timezone,
        branch.paymentPolicy,
        client,
      );
      await this.ordersRepository.addItems(created.id, computedItems, client);
      await this.ordersRepository.updateTotals(
        created.id,
        totals.subtotal,
        totals.discountAmount,
        totals.taxAmount,
        totals.deliveryFee,
        totals.totalAmount,
        client,
      );
      await this.ordersRepository.addStatusHistory(
        created.id,
        null,
        OrderStatus.PENDING,
        actorUserId,
        undefined,
        client,
      );
      return created;
    });

    await this.auditService.record({
      businessId: data.businessId,
      branchId: data.branchId,
      userId: actorUserId,
      entityType: 'order',
      entityId: row.id,
      action: 'CREATE',
      newValues: {
        orderNumber: row.order_number,
        totalAmount: totals.totalAmount,
      },
    });

    return this.buildWithItems({ ...row, ...totalsToRow(totals) });
  }

  async findAll(query: OrderQuery): Promise<PaginatedResult<Order>> {
    const { rows, total } = await this.ordersRepository.findAll(query);
    return {
      data: rows.map((row) => OrderMapper.toDomain(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(businessId: string, id: string): Promise<OrderWithItems> {
    const row = await this.getOwnedOrFail(businessId, id);
    return this.buildWithItems(row);
  }

  /** Used by KitchenService: orders CONFIRMED/PREPARING, oldest first. */
  async getKitchenQueue(
    businessId: string,
    branchId?: string,
  ): Promise<Order[]> {
    const rows = await this.ordersRepository.findActiveForKitchen(
      businessId,
      branchId,
    );
    return rows.map((row) => OrderMapper.toDomain(row));
  }

  /** Used by DashboardService: orders still in the pipeline (not DELIVERED/CANCELLED). */
  async getActiveCount(businessId: string, branchId?: string): Promise<number> {
    return this.ordersRepository.getActiveCount(businessId, branchId);
  }

  /** Used by the public NFC ordering endpoint to decide create vs. addItems for a table. */
  async findActiveIdForTable(
    businessId: string,
    branchId: string,
    tableNumber: string,
  ): Promise<string | null> {
    const row = await this.ordersRepository.findActiveByTable(
      businessId,
      branchId,
      tableNumber,
    );
    return row?.id ?? null;
  }

  /** Orders left open from before the business's current local calendar day. */
  async getBacklog(businessId: string, branchId?: string): Promise<Order[]> {
    const timezone = await this.businessesService.getTimezone(businessId);
    const rows = await this.ordersRepository.findBacklog(
      businessId,
      timezone,
      branchId,
    );
    return rows.map((row) => OrderMapper.toDomain(row));
  }

  /**
   * Used by DashboardService and AnalyticsService: the sales of a date range.
   * A sale is an order paid in full and not cancelled, dated by the payment
   * that completed it — see SALES in OrdersRepository.
   */
  async getSalesSummary(
    businessId: string,
    branchId: string | undefined,
    dateFrom: string,
    dateTo: string,
  ): Promise<SalesSummary> {
    const row = await this.ordersRepository.getSalesSummary(
      businessId,
      branchId,
      dateFrom,
      dateTo,
    );
    return {
      orderCount: parseInt(row.order_count, 10),
      totalAmount: row.total_amount ? parseFloat(row.total_amount) : 0,
    };
  }

  /** Used by AnalyticsService: sales grouped by the business's calendar day. */
  async getSalesByDay(
    businessId: string,
    branchId: string | undefined,
    dateFrom: string,
    dateTo: string,
  ): Promise<DailySales[]> {
    const timezone = await this.businessesService.getTimezone(businessId);
    const rows = await this.ordersRepository.getSalesByDay(
      businessId,
      branchId,
      dateFrom,
      dateTo,
      timezone,
    );
    return rows.map((row) => ({
      date: row.date,
      orderCount: parseInt(row.order_count, 10),
      totalAmount: parseFloat(row.total_amount),
    }));
  }

  /** Used by AnalyticsService: best-selling products within a date range, by revenue unless asked by quantity. */
  async getTopProducts(
    businessId: string,
    branchId: string | undefined,
    dateFrom: string,
    dateTo: string,
    limit: number,
    orderBy: TopProductsOrder = 'revenue',
  ): Promise<TopProduct[]> {
    const rows = await this.ordersRepository.getTopProducts(
      businessId,
      branchId,
      dateFrom,
      dateTo,
      limit,
      orderBy,
    );
    return rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      quantitySold: parseFloat(row.quantity_sold),
      revenue: parseFloat(row.revenue),
    }));
  }

  /** The products most ordered in a range, paid or not (orders not cancelled, by when they were taken). */
  async getMostOrdered(
    businessId: string,
    branchId: string | undefined,
    dateFrom: string,
    dateTo: string,
    limit: number,
  ): Promise<MostOrdered> {
    const row = await this.ordersRepository.getMostOrdered(
      businessId,
      branchId,
      dateFrom,
      dateTo,
      limit,
    );
    return {
      orderCount: parseInt(row.order_count, 10),
      productIds: row.product_ids ?? [],
    };
  }

  /** Adds items to an existing order without touching the ones already there — a running tab. */
  async addItems(
    businessId: string,
    id: string,
    items: OrderItemInput[],
    actorUserId?: string,
  ): Promise<OrderWithItems> {
    if (items.length === 0) {
      throw new BusinessRuleException(
        'An order must include at least one item',
        'ORDER_EMPTY',
      );
    }
    const order = await this.getOwnedOrFail(businessId, id);
    if (
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new BusinessRuleException(
        'Items cannot be added to a delivered or cancelled order',
        'ORDER_NOT_EDITABLE',
      );
    }
    // Once an order has been sent to kitchen at least once, a PREPAY_REQUIRED
    // policy keeps applying to every addition — never let cocina receive more
    // food while a balance is still owed on what's already been ordered.
    if (
      order.status !== OrderStatus.PENDING &&
      order.payment_policy === PaymentPolicy.PREPAY_REQUIRED
    ) {
      const totalPaid = round2(await this.ordersRepository.getTotalPaid(id));
      if (totalPaid < parseFloat(order.total_amount)) {
        throw new BusinessRuleException(
          'New items cannot be added while this order has a pending balance',
          'PAYMENT_REQUIRED_FOR_ADDITION',
        );
      }
    }

    const computedItems = await this.computeItems(
      businessId,
      order.branch_id,
      items,
      'all',
    );
    const taxRate = await this.businessesService.getTaxRate(businessId);
    const additionalSubtotal = round2(
      computedItems.reduce((sum, item) => sum + item.totalPrice, 0),
    );
    const newSubtotal = round2(parseFloat(order.subtotal) + additionalSubtotal);
    const totals = this.computeTotalsFromSubtotal(
      newSubtotal,
      this.discountFor(order, newSubtotal),
      parseFloat(order.delivery_fee),
      taxRate,
    );

    let newPaymentStatus: OrderPaymentStatus = order.payment_status;

    await this.transactionService.execute(async (client) => {
      await this.ordersRepository.addItems(id, computedItems, client);
      await this.ordersRepository.updateTotals(
        id,
        totals.subtotal,
        totals.discountAmount,
        totals.taxAmount,
        totals.deliveryFee,
        totals.totalAmount,
        client,
      );
      // Items present at the PENDING -> CONFIRMED transition already have their
      // stock consumed by consumeStock(); anything added after that point needs
      // its own consumption now, or it would never be decremented.
      if (order.status !== OrderStatus.PENDING) {
        await this.consumeStockForItems(
          order,
          computedItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          client,
          actorUserId,
        );
      }

      // The new total can outgrow what was already paid (e.g. a fully PAID order
      // that just got more items) — recompute payment_status against the new
      // total instead of leaving a stale PAID/PARTIALLY_PAID status behind.
      // Existing payments are never touched here, only re-evaluated against
      // the new total.
      const totalPaid = round2(
        await this.ordersRepository.getTotalPaid(id, client),
      );
      newPaymentStatus =
        totalPaid <= 0
          ? OrderPaymentStatus.PENDING
          : totalPaid < totals.totalAmount
            ? OrderPaymentStatus.PARTIALLY_PAID
            : OrderPaymentStatus.PAID;
      await this.ordersRepository.updatePaymentStatus(
        id,
        newPaymentStatus,
        client,
      );
    });

    await this.auditService.record({
      businessId,
      branchId: order.branch_id,
      userId: actorUserId,
      entityType: 'order',
      entityId: id,
      action: 'ADD_ITEMS',
      newValues: { itemCount: items.length, additionalSubtotal },
    });

    return this.buildWithItems({
      ...order,
      ...totalsToRow(totals),
      payment_status: newPaymentStatus,
    });
  }

  async replaceItems(
    businessId: string,
    id: string,
    items: OrderItemInput[],
    actorUserId?: string,
  ): Promise<OrderWithItems> {
    if (items.length === 0) {
      throw new BusinessRuleException(
        'An order must include at least one item',
        'ORDER_EMPTY',
      );
    }
    const order = await this.getOwnedOrFail(businessId, id);
    if (
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new BusinessRuleException(
        'Items cannot be edited on a delivered or cancelled order',
        'ORDER_NOT_EDITABLE',
      );
    }

    // What the order already had keeps going through even if it ran out since
    // (its own stock may be what used it up); only new products are checked.
    const alreadyOrdered = new Set(
      (await this.ordersRepository.findItems(id)).map(
        (item) => item.product_id,
      ),
    );
    const computedItems = await this.computeItems(
      businessId,
      order.branch_id,
      items,
      new Set(
        items
          .map((item) => item.productId)
          .filter((productId) => !alreadyOrdered.has(productId)),
      ),
    );
    const taxRate = await this.businessesService.getTaxRate(businessId);
    const itemsSubtotal = round2(
      computedItems.reduce((sum, item) => sum + item.totalPrice, 0),
    );
    const totals = this.computeTotals(
      computedItems,
      this.discountFor(order, itemsSubtotal),
      parseFloat(order.delivery_fee),
      taxRate,
    );

    await this.transactionService.execute(async (client) => {
      // Orders CONFIRMED onward already have stock consumed against the old item set —
      // reverse that net consumption before writing the new items, then consume fresh for
      // the new set (mirrors addItems()'s post-PENDING branch).
      if (order.status !== OrderStatus.PENDING) {
        await this.reverseStock(order, client, actorUserId);
      }
      await this.ordersRepository.replaceItems(id, computedItems, client);
      await this.ordersRepository.updateTotals(
        id,
        totals.subtotal,
        totals.discountAmount,
        totals.taxAmount,
        totals.deliveryFee,
        totals.totalAmount,
        client,
      );
      if (order.status !== OrderStatus.PENDING) {
        await this.consumeStockForItems(
          order,
          computedItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          client,
          actorUserId,
        );
      }
    });

    await this.auditService.record({
      businessId,
      branchId: order.branch_id,
      userId: actorUserId,
      entityType: 'order',
      entityId: id,
      action: 'UPDATE_ITEMS',
      newValues: { itemCount: items.length },
    });

    return this.buildWithItems({ ...order, ...totalsToRow(totals) });
  }

  async updateStatus(
    businessId: string,
    id: string,
    newStatus: OrderStatus,
    actorUserId?: string,
    notes?: string,
  ): Promise<OrderWithItems> {
    const order = await this.getOwnedOrFail(businessId, id);
    if (!ALLOWED_TRANSITIONS[order.status].includes(newStatus)) {
      throw new InvalidOrderStatusTransitionException(order.status, newStatus);
    }
    if (
      newStatus === OrderStatus.CONFIRMED &&
      order.payment_policy === PaymentPolicy.PREPAY_REQUIRED
    ) {
      const totalPaid = round2(await this.ordersRepository.getTotalPaid(id));
      if (totalPaid < parseFloat(order.total_amount)) {
        throw new BusinessRuleException(
          'This order requires full payment before it can be sent to kitchen',
          'PAYMENT_REQUIRED_BEFORE_KITCHEN',
        );
      }
    }

    const updated = await this.transactionService.execute(async (client) => {
      if (newStatus === OrderStatus.CONFIRMED) {
        await this.consumeStock(order, client, actorUserId);
      }
      if (
        newStatus === OrderStatus.CANCELLED &&
        order.status !== OrderStatus.PENDING
      ) {
        await this.reverseStock(order, client, actorUserId);
      }

      const row = await this.ordersRepository.setStatus(
        id,
        businessId,
        newStatus,
        STATUS_TIMESTAMP_COLUMN[newStatus],
        client,
      );
      if (!row) {
        throw new EntityNotFoundException('Order', id);
      }
      await this.ordersRepository.addStatusHistory(
        id,
        order.status,
        newStatus,
        actorUserId,
        notes,
        client,
      );

      if (newStatus === OrderStatus.DELIVERED && order.customer_id) {
        const amountSpent = parseFloat(order.total_amount);
        await this.customersService.recordCompletedOrder(
          order.customer_id,
          amountSpent,
          client,
        );
        await this.loyaltyService.awardPointsForOrder(
          businessId,
          order.customer_id,
          amountSpent,
          client,
        );
      }

      return row;
    });

    await this.auditService.record({
      businessId,
      branchId: order.branch_id,
      userId: actorUserId,
      entityType: 'order',
      entityId: id,
      action: newStatus,
    });

    return this.buildWithItems(updated);
  }

  /**
   * Used by unattended channels (Car Service kiosk, public NFC ordering) that have no
   * human to gate on: confirms the order when its payment policy allows it, otherwise
   * leaves it PENDING for staff to confirm manually after collecting payment, instead
   * of failing the whole request.
   */
  async tryAutoConfirm(
    businessId: string,
    id: string,
  ): Promise<OrderWithItems> {
    try {
      return await this.updateStatus(businessId, id, OrderStatus.CONFIRMED);
    } catch (error) {
      if (
        error instanceof BusinessRuleException &&
        error.code === 'PAYMENT_REQUIRED_BEFORE_KITCHEN'
      ) {
        return this.findOne(businessId, id);
      }
      throw error;
    }
  }

  /** Used by PaymentsService after registering a payment, to sync the order's payment_status. */
  async syncPaymentStatus(
    id: string,
    paymentStatus: string,
    client?: DbClient,
  ): Promise<void> {
    await this.ordersRepository.updatePaymentStatus(id, paymentStatus, client);
  }

  /** Used by PaymentsService/KitchenService to validate ownership without building the full item list. */
  async getOwnedOrFail(businessId: string, id: string): Promise<OrderRow> {
    const row = await this.ordersRepository.findById(id, businessId);
    if (!row) {
      throw new EntityNotFoundException('Order', id);
    }
    return row;
  }

  private async consumeStock(
    order: OrderRow,
    client: DbClient,
    actorUserId?: string,
  ): Promise<void> {
    const items = await this.ordersRepository.findItems(order.id, client);
    await this.consumeStockForItems(
      order,
      items.map((item) => ({
        productId: item.product_id,
        quantity: parseFloat(item.quantity),
      })),
      client,
      actorUserId,
    );
  }

  private async consumeStockForItems(
    order: OrderRow,
    items: { productId: string | null; quantity: number }[],
    client: DbClient,
    actorUserId?: string,
  ): Promise<void> {
    for (const item of items) {
      if (!item.productId) {
        continue;
      }
      const product = await this.productsService.getOwnedOrFail(
        order.business_id,
        item.productId,
      );
      if (!product.track_inventory) {
        continue;
      }
      const recipe = await this.recipesService.findByProductOrNull(
        order.business_id,
        item.productId,
      );
      if (!recipe) {
        continue;
      }
      for (const recipeItem of recipe.items) {
        const consumeQuantity =
          (recipeItem.quantity / recipe.cost.yieldQuantity) * item.quantity;
        await this.movementsService.recordMovement(
          {
            businessId: order.business_id,
            branchId: order.branch_id,
            inventoryItemId: recipeItem.inventoryItemId,
            movementType: InventoryMovementType.SALE_CONSUMPTION,
            quantity: consumeQuantity,
            referenceType: 'order',
            referenceId: order.id,
            createdBy: actorUserId,
          },
          client,
        );
      }
    }
  }

  /**
   * Reverses whatever stock is currently, net, outstanding for this order (SALE_CONSUMPTION
   * minus prior RETURNs, all tagged referenceType 'order') — not just the original consumption.
   * This makes it safe to call more than once across an order's life (e.g. on every item edit,
   * and again on eventual cancellation) without double-reversing what an earlier edit already
   * returned.
   */
  private async reverseStock(
    order: OrderRow,
    client: DbClient,
    actorUserId?: string,
  ): Promise<void> {
    const movements = await this.movementsService.getMovementsByReference(
      'order',
      order.id,
      client,
    );
    const netByItem = new Map<string, number>();
    for (const movement of movements) {
      if (movement.movementType === InventoryMovementType.SALE_CONSUMPTION) {
        netByItem.set(
          movement.inventoryItemId,
          (netByItem.get(movement.inventoryItemId) ?? 0) + movement.quantity,
        );
      } else if (movement.movementType === InventoryMovementType.RETURN) {
        netByItem.set(
          movement.inventoryItemId,
          (netByItem.get(movement.inventoryItemId) ?? 0) - movement.quantity,
        );
      }
    }

    for (const [inventoryItemId, quantity] of netByItem) {
      if (quantity <= 0) {
        continue;
      }
      await this.movementsService.recordMovement(
        {
          businessId: order.business_id,
          branchId: order.branch_id,
          inventoryItemId,
          movementType: InventoryMovementType.RETURN,
          quantity,
          referenceType: 'order',
          referenceId: order.id,
          createdBy: actorUserId,
        },
        client,
      );
    }
  }

  /**
   * The items as the branch sells them: at its price, refusing what it does
   * not offer and, for the products in `checkStock` (all of them, or a set),
   * what it ran out of.
   */
  private async computeItems(
    businessId: string,
    branchId: string,
    items: OrderItemInput[],
    checkStock: 'all' | Set<string>,
  ): Promise<OrderItemComputed[]> {
    const productIds = [...new Set(items.map((item) => item.productId))];
    // The business's whole option catalog and what each product offers, once
    // per order — not per item.
    const [optionGroups, offeredByProduct, branchMenu] = await Promise.all([
      this.optionGroupsService.findAll(businessId),
      this.optionGroupsService.getProductGroups(productIds),
      this.branchMenuService.forBranch(businessId, branchId, productIds),
    ]);
    const computed: OrderItemComputed[] = [];
    for (const item of items) {
      const product = await this.productsService.getOwnedOrFail(
        businessId,
        item.productId,
      );
      if (!product.is_active) {
        // Re-checked at order time, not just when a menu/catalog was first
        // loaded — a product can be deactivated in the window between a
        // customer/kiosk fetching the menu and actually submitting the order.
        // isVisible is deliberately NOT checked here: a hidden-but-active
        // product (e.g. an internal invoicing surcharge) must stay orderable
        // by staff even though it's excluded from the public menu.
        throw new BusinessRuleException(
          `Product "${product.name}" is not active and cannot be ordered`,
          'ORDER_ITEM_PRODUCT_INACTIVE',
        );
      }
      const atBranch = branchMenu.get(product.id);
      if (atBranch && !atBranch.isAvailable) {
        throw new BusinessRuleException(
          `"${product.name}" no se vende en esta sede`,
          'ORDER_ITEM_NOT_AT_BRANCH',
        );
      }
      if (
        atBranch?.outOfStock &&
        (checkStock === 'all' || checkStock.has(product.id))
      ) {
        throw new BusinessRuleException(
          `"${product.name}" está agotado en esta sede: no hay insumos para prepararlo`,
          'ORDER_ITEM_OUT_OF_STOCK',
        );
      }
      const unitPrice = atBranch?.salePrice ?? parseFloat(product.sale_price);
      const discountAmount = item.discountAmount ?? 0;
      const totalPrice = round2(unitPrice * item.quantity - discountAmount);
      if (totalPrice < 0) {
        throw new BusinessRuleException(
          `Discount cannot exceed the line total for product "${product.name}"`,
          'ORDER_ITEM_DISCOUNT_EXCEEDS_TOTAL',
        );
      }

      // sauceIds/sideIds are what clients sent before option groups existed;
      // the migrated options kept their ids, so they're simply more picks.
      const pickedIds = [
        ...(item.optionItemIds ?? []),
        ...(item.sauceIds ?? []),
        ...(item.sideIds ?? []),
      ];
      const optionSelections = resolveOptionSelections(
        optionGroups,
        offeredByProduct.get(product.id) ?? [],
        pickedIds,
        product.name,
      );

      computed.push({
        productId: item.productId,
        quantity: item.quantity,
        discountAmount: item.discountAmount,
        notes: item.notes,
        productNameSnapshot: product.name,
        productDescriptionSnapshot: product.description,
        unitPrice,
        unitCostSnapshot: parseFloat(product.current_cost),
        totalPrice,
        optionSelections,
      });
    }
    return computed;
  }

  /**
   * Applies (or, with NONE, removes) the order's discount at checkout: a
   * promotion, a coupon or a manual percentage, of the subtotal (before tax
   * and delivery). Only before anything is paid, so payments never end up
   * covering a different total than the one charged.
   */
  async applyDiscount(
    businessId: string,
    id: string,
    choice: CheckoutDiscountChoice | { source: 'NONE' },
    actorUserId?: string,
  ): Promise<OrderWithItems> {
    const order = await this.getOwnedOrFail(businessId, id);
    if (order.status === OrderStatus.CANCELLED) {
      throw new BusinessRuleException(
        'El pedido está cancelado',
        'ORDER_NOT_EDITABLE',
      );
    }
    if (round2(await this.ordersRepository.getTotalPaid(id)) > 0) {
      throw new BusinessRuleException(
        'El pedido ya tiene pagos registrados: el descuento se aplica antes de cobrar',
        'ORDER_HAS_PAYMENTS',
      );
    }
    // Removing one stays possible when the business has turned them off.
    if (
      choice.source !== 'NONE' &&
      !(await this.businessesService.getDiscountsAtCheckout(businessId))
    ) {
      throw new BusinessRuleException(
        'Los descuentos al cobrar están desactivados en la configuración',
        'DISCOUNTS_AT_CHECKOUT_DISABLED',
      );
    }

    const applied =
      choice.source === 'NONE'
        ? null
        : await this.discountsService.resolve(businessId, choice);
    const subtotal = parseFloat(order.subtotal);
    const taxRate = await this.businessesService.getTaxRate(businessId);
    const totals = this.computeTotalsFromSubtotal(
      subtotal,
      applied ? discountAmountFor(subtotal, applied.percent) : 0,
      parseFloat(order.delivery_fee),
      taxRate,
    );

    await this.transactionService.execute(async (client) => {
      const previousId = order.discount_id ?? null;
      const nextId = applied?.discountId ?? null;
      if (previousId && previousId !== nextId) {
        await this.discountsService.releaseUse(previousId, client);
      }
      if (nextId && nextId !== previousId) {
        if (!(await this.discountsService.takeUse(nextId, client))) {
          throw new BusinessRuleException(
            'Ese descuento ya alcanzó su límite de usos',
            'DISCOUNT_NOT_USABLE',
          );
        }
      }
      await this.ordersRepository.updateTotals(
        id,
        totals.subtotal,
        totals.discountAmount,
        totals.taxAmount,
        totals.deliveryFee,
        totals.totalAmount,
        client,
      );
      await this.ordersRepository.setDiscount(
        id,
        applied
          ? {
              percent: applied.percent,
              discountId: applied.discountId,
              source: applied.source,
              label: applied.label,
            }
          : null,
        client,
      );
    });

    await this.auditService.record({
      businessId,
      branchId: order.branch_id,
      userId: actorUserId,
      entityType: 'order',
      entityId: id,
      action: applied ? 'APPLY_DISCOUNT' : 'REMOVE_DISCOUNT',
      oldValues: {
        discountAmount: parseFloat(order.discount_amount),
        discountLabel: order.discount_label ?? null,
      },
      newValues: {
        discountAmount: totals.discountAmount,
        discountLabel: applied?.label ?? null,
        source: applied?.source ?? null,
      },
    });

    return this.buildWithItems({
      ...order,
      ...totalsToRow(totals),
      discount_percent: applied ? String(applied.percent) : null,
      discount_id: applied?.discountId ?? null,
      discount_source: applied?.source ?? null,
      discount_label: applied?.label ?? null,
    });
  }

  /**
   * The discount for a new subtotal: a percentage follows it; a fixed amount
   * (set when the order was created) stays as it was.
   */
  private discountFor(order: OrderRow, subtotal: number): number {
    return order.discount_percent != null
      ? discountAmountFor(subtotal, parseFloat(order.discount_percent))
      : parseFloat(order.discount_amount);
  }

  private computeTotals(
    items: OrderItemComputed[],
    discountAmount: number,
    deliveryFee: number,
    taxRate: number,
  ): {
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    deliveryFee: number;
    totalAmount: number;
  } {
    const subtotal = round2(
      items.reduce((sum, item) => sum + item.totalPrice, 0),
    );
    return this.computeTotalsFromSubtotal(
      subtotal,
      discountAmount,
      deliveryFee,
      taxRate,
    );
  }

  private computeTotalsFromSubtotal(
    subtotal: number,
    discountAmount: number,
    deliveryFee: number,
    taxRate: number,
  ): {
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    deliveryFee: number;
    totalAmount: number;
  } {
    const taxableBase = Math.max(subtotal - discountAmount, 0);
    const taxAmount = round2(taxableBase * taxRate);
    const totalAmount = round2(taxableBase + taxAmount + deliveryFee);
    return { subtotal, discountAmount, taxAmount, deliveryFee, totalAmount };
  }

  private async buildWithItems(row: OrderRow): Promise<OrderWithItems> {
    const itemRows = await this.ordersRepository.findItems(row.id);
    return {
      ...OrderMapper.toDomain(row),
      items: itemRows.map((itemRow) => OrderMapper.itemToDomain(itemRow)),
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function totalsToRow(totals: {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  deliveryFee: number;
  totalAmount: number;
}): Partial<OrderRow> {
  return {
    subtotal: String(totals.subtotal),
    discount_amount: String(totals.discountAmount),
    tax_amount: String(totals.taxAmount),
    delivery_fee: String(totals.deliveryFee),
    total_amount: String(totals.totalAmount),
  };
}
