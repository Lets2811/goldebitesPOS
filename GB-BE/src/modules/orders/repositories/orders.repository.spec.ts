import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import { OrderStatus, OrderType } from '../domain/order.interface';
import { OrdersRepository } from './orders.repository';

/**
 * Integration test against the real test database (golden_bites_test).
 * setStatus() is a regression test for the dynamic timestamp-column SQL:
 * the column name is interpolated (never a bind parameter) from a fixed
 * internal map in OrdersService, and must only touch the one column for
 * the target status, leaving the others untouched.
 */
describe('OrdersRepository (integration)', () => {
  let pool: Pool;
  let db: DatabaseService;
  let repository: OrdersRepository;
  let businessId: string;
  let branchId: string;
  let productId: string;
  let waiterId: string;
  let otherWaiterId: string;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      database: 'golden_bites_test',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    db = new DatabaseService(pool);
    repository = new OrdersRepository(db);

    const business = await pool.query<{ id: string }>(
      `INSERT INTO businesses (name) VALUES ($1) RETURNING id`,
      [`Test Business ${randomUUID()}`],
    );
    businessId = business.rows[0].id;

    const branch = await pool.query<{ id: string }>(
      `INSERT INTO branches (business_id, name) VALUES ($1, $2) RETURNING id`,
      [businessId, `Test Branch ${randomUUID()}`],
    );
    branchId = branch.rows[0].id;

    const product = await pool.query<{ id: string }>(
      `INSERT INTO products (branch_id, business_id, name, sale_price) VALUES ((SELECT id FROM branches WHERE business_id = $1 ORDER BY created_at, id LIMIT 1), $1, 'Burger', 25000) RETURNING id`,
      [businessId],
    );
    productId = product.rows[0].id;

    const role = await pool.query<{ id: string }>(
      `INSERT INTO roles (business_id, name) VALUES ($1, 'WAITER') RETURNING id`,
      [businessId],
    );
    const waiter = await pool.query<{ id: string }>(
      `INSERT INTO users (business_id, branch_id, role_id, first_name, last_name, email, password_hash)
       VALUES ($1, $2, $3, 'Test', 'Waiter', $4, 'hash')
       RETURNING id`,
      [
        businessId,
        branchId,
        role.rows[0].id,
        `waiter.${randomUUID()}@example.com`,
      ],
    );
    waiterId = waiter.rows[0].id;
    const otherWaiter = await pool.query<{ id: string }>(
      `INSERT INTO users (business_id, branch_id, role_id, first_name, last_name, email, password_hash)
       VALUES ($1, $2, $3, 'Test', 'OtherWaiter', $4, 'hash')
       RETURNING id`,
      [
        businessId,
        branchId,
        role.rows[0].id,
        `waiter2.${randomUUID()}@example.com`,
      ],
    );
    otherWaiterId = otherWaiter.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(
      'DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE business_id = $1)',
      [businessId],
    );
    await pool.query(
      'DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE business_id = $1)',
      [businessId],
    );
    await pool.query(
      'DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE business_id = $1)',
      [businessId],
    );
    await pool.query('DELETE FROM orders WHERE business_id = $1', [businessId]);
    await pool.query(
      'DELETE FROM daily_order_counters WHERE business_id = $1',
      [businessId],
    );
    await pool.query('DELETE FROM products WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM users WHERE business_id = $1', [businessId]);
    await pool.query('DELETE FROM roles WHERE business_id = $1', [businessId]);
    await pool.query('DELETE FROM branches WHERE id = $1', [branchId]);
    await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);
    await pool.end();
  });

  it('create() assigns a daily MMDD-NN order_number and defaults to PENDING', async () => {
    const order = await repository.create(
      { businessId, branchId, orderType: OrderType.DINE_IN },
      undefined,
    );

    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.order_number).toMatch(/^\d{4}-\d{2,}$/);
  });

  it('create() increments the daily counter per business and resets per calendar day', async () => {
    const first = await repository.create(
      { businessId, branchId, orderType: OrderType.DINE_IN },
      undefined,
    );
    const second = await repository.create(
      { businessId, branchId, orderType: OrderType.DINE_IN },
      undefined,
    );

    const [firstDate, firstSeq] = first.order_number.split('-');
    const [secondDate, secondSeq] = second.order_number.split('-');
    expect(secondDate).toBe(firstDate);
    expect(parseInt(secondSeq, 10)).toBe(parseInt(firstSeq, 10) + 1);
  });

  it('create() keeps numbering past the 99th order of the day instead of repeating "-10"', async () => {
    const first = await repository.create(
      { businessId, branchId, orderType: OrderType.DINE_IN },
      undefined,
    );
    const [day] = first.order_number.split('-');
    // As if the day had already reached order 99.
    await pool.query(
      `UPDATE daily_order_counters SET last_number = 99
       WHERE business_id = $1 AND to_char(order_date, 'MMDD') = $2`,
      [businessId, day],
    );

    const hundredth = await repository.create(
      { businessId, branchId, orderType: OrderType.DINE_IN },
      undefined,
    );

    expect(hundredth.order_number).toBe(`${day}-100`);
  });

  it('getTotalPaid() sums every payment registered against the order', async () => {
    const order = await repository.create(
      { businessId, branchId, orderType: OrderType.DINE_IN },
      undefined,
    );

    const noPaymentsYet = await repository.getTotalPaid(order.id);
    expect(noPaymentsYet).toBe(0);

    await pool.query(
      `INSERT INTO payments (order_id, payment_method, amount) VALUES ($1, 'CASH', 30000)`,
      [order.id],
    );
    await pool.query(
      `INSERT INTO payments (order_id, payment_method, amount) VALUES ($1, 'CARD', 20000)`,
      [order.id],
    );

    const totalPaid = await repository.getTotalPaid(order.id);
    expect(totalPaid).toBe(50000);
  });

  it('addItems() + findItems() persist decimal quantities correctly', async () => {
    const order = await repository.create(
      { businessId, branchId, orderType: OrderType.TAKEAWAY },
      undefined,
    );

    await repository.addItems(order.id, [
      {
        productId,
        quantity: 2.5,
        productNameSnapshot: 'Burger',
        productDescriptionSnapshot: null,
        unitPrice: 25000,
        unitCostSnapshot: 8000,
        totalPrice: 62500,
        optionSelections: [],
      },
    ]);

    const items = await repository.findItems(order.id);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe('2.500');
    expect(items[0].total_price).toBe('62500.00');
  });

  it('replaceItems() fully replaces the previous set', async () => {
    const order = await repository.create(
      { businessId, branchId, orderType: OrderType.TAKEAWAY },
      undefined,
    );
    await repository.addItems(order.id, [
      {
        productId,
        quantity: 1,
        productNameSnapshot: 'Burger',
        productDescriptionSnapshot: null,
        unitPrice: 25000,
        unitCostSnapshot: 8000,
        totalPrice: 25000,
        optionSelections: [],
      },
    ]);

    await repository.replaceItems(order.id, [
      {
        productId,
        quantity: 3,
        productNameSnapshot: 'Burger',
        productDescriptionSnapshot: null,
        unitPrice: 25000,
        unitCostSnapshot: 8000,
        totalPrice: 75000,
        optionSelections: [],
      },
    ]);

    const items = await repository.findItems(order.id);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe('3.000');
  });

  it('setStatus() only stamps the timestamp column mapped to the target status', async () => {
    const order = await repository.create(
      { businessId, branchId, orderType: OrderType.DINE_IN },
      undefined,
    );

    const confirmed = await repository.setStatus(
      order.id,
      businessId,
      OrderStatus.CONFIRMED,
      'confirmed_at',
    );
    expect(confirmed?.confirmed_at).not.toBeNull();
    expect(confirmed?.prepared_at).toBeNull();

    const preparing = await repository.setStatus(
      order.id,
      businessId,
      OrderStatus.PREPARING,
      null,
    );
    expect(preparing?.prepared_at).toBeNull();

    const ready = await repository.setStatus(
      order.id,
      businessId,
      OrderStatus.READY,
      'prepared_at',
    );
    expect(ready?.prepared_at).not.toBeNull();
    expect(ready?.delivered_at).toBeNull();
  });

  it('findActiveForKitchen() only returns CONFIRMED/PREPARING orders for the branch', async () => {
    const pending = await repository.create(
      { businessId, branchId, orderType: OrderType.DINE_IN },
      undefined,
    );
    const confirmed = await repository.create(
      { businessId, branchId, orderType: OrderType.DINE_IN },
      undefined,
    );
    await repository.setStatus(
      confirmed.id,
      businessId,
      OrderStatus.CONFIRMED,
      'confirmed_at',
    );

    const queue = await repository.findActiveForKitchen(businessId, branchId);
    const ids = queue.map((row) => row.id);

    expect(ids).toContain(confirmed.id);
    expect(ids).not.toContain(pending.id);
  });

  it('findActiveByTable() finds the newest non-DELIVERED/CANCELLED DINE_IN order for that table, ignoring other tables/types/statuses', async () => {
    const otherTable = await repository.create(
      { businessId, branchId, orderType: OrderType.DINE_IN, tableNumber: '77' },
      undefined,
    );
    const cancelled = await repository.create(
      { businessId, branchId, orderType: OrderType.DINE_IN, tableNumber: '42' },
      undefined,
    );
    await repository.setStatus(
      cancelled.id,
      businessId,
      OrderStatus.CANCELLED,
      'cancelled_at',
    );
    const active = await repository.create(
      { businessId, branchId, orderType: OrderType.DINE_IN, tableNumber: '42' },
      undefined,
    );

    const found = await repository.findActiveByTable(
      businessId,
      branchId,
      '42',
    );

    expect(found?.id).toBe(active.id);
    expect(found?.id).not.toBe(cancelled.id);
    expect(found?.id).not.toBe(otherTable.id);
  });

  it('findActiveByTable() returns null when the table has no active order', async () => {
    const found = await repository.findActiveByTable(
      businessId,
      branchId,
      'no-such-table',
    );
    expect(found).toBeNull();
  });

  it('findAll() filters by createdBy', async () => {
    const own = await repository.create(
      { businessId, branchId, orderType: OrderType.DINE_IN },
      waiterId,
    );
    await repository.create(
      { businessId, branchId, orderType: OrderType.DINE_IN },
      otherWaiterId,
    );

    const { rows } = await repository.findAll({
      businessId,
      page: 1,
      limit: 50,
      createdBy: waiterId,
    });
    const ids = rows.map((row) => row.id);

    expect(ids).toContain(own.id);
    expect(ids).toHaveLength(1);
  });

  it('addStatusHistory() + findStatusHistory() record the transition trail', async () => {
    const order = await repository.create(
      { businessId, branchId, orderType: OrderType.DINE_IN },
      undefined,
    );
    await repository.addStatusHistory(
      order.id,
      null,
      OrderStatus.PENDING,
      undefined,
      undefined,
    );
    await repository.addStatusHistory(
      order.id,
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      undefined,
      'looks good',
    );

    const history = await repository.findStatusHistory(order.id);
    expect(history).toHaveLength(2);
    expect(history[1].new_status).toBe(OrderStatus.CONFIRMED);
    expect(history[1].notes).toBe('looks good');
  });

  describe('reporting aggregates', () => {
    async function createSale(
      quantity: number,
      unitPrice: number,
    ): Promise<string> {
      const order = await repository.create(
        { businessId, branchId, orderType: OrderType.TAKEAWAY },
        undefined,
      );
      await repository.addItems(order.id, [
        {
          productId,
          quantity,
          productNameSnapshot: 'Burger',
          productDescriptionSnapshot: null,
          unitPrice,
          unitCostSnapshot: 8000,
          totalPrice: quantity * unitPrice,
          optionSelections: [],
        },
      ]);
      await repository.updateTotals(
        order.id,
        quantity * unitPrice,
        0,
        0,
        0,
        quantity * unitPrice,
      );
      await repository.setStatus(
        order.id,
        businessId,
        OrderStatus.DELIVERED,
        'delivered_at',
      );
      await pay(order.id, quantity * unitPrice);
      return order.id;
    }

    /** Registers a payment and, when it covers the order, marks the order paid — as PaymentsService does. */
    async function pay(orderId: string, amount: number, full = true) {
      await pool.query(
        `INSERT INTO payments (order_id, payment_method, amount) VALUES ($1, 'CASH', $2)`,
        [orderId, amount],
      );
      await pool.query(`UPDATE orders SET payment_status = $2 WHERE id = $1`, [
        orderId,
        full ? 'PAID' : 'PARTIALLY_PAID',
      ]);
    }

    it('getActiveCount() only counts orders still in the pipeline', async () => {
      await repository.create(
        { businessId, branchId, orderType: OrderType.DINE_IN },
        undefined,
      );
      await createSale(1, 1000);

      const active = await repository.getActiveCount(businessId, branchId);
      expect(active).toBeGreaterThanOrEqual(1);
    });

    it('getSalesSummary() sums the sales within the date range', async () => {
      await createSale(2, 5000);

      const now = new Date();
      const dateFrom = new Date(now.getTime() - 60000).toISOString();
      const dateTo = new Date(now.getTime() + 60000).toISOString();

      const summary = await repository.getSalesSummary(
        businessId,
        branchId,
        dateFrom,
        dateTo,
      );
      expect(parseInt(summary.order_count, 10)).toBeGreaterThanOrEqual(1);
      expect(parseFloat(summary.total_amount ?? '0')).toBeGreaterThanOrEqual(
        10000,
      );
    });

    it('getSalesByDay() groups totals by calendar day', async () => {
      await createSale(1, 3000);

      const now = new Date();
      const dateFrom = new Date(now.getTime() - 60000).toISOString();
      const dateTo = new Date(now.getTime() + 60000).toISOString();

      const days = await repository.getSalesByDay(
        businessId,
        branchId,
        dateFrom,
        dateTo,
        'America/Bogota',
      );
      expect(days.length).toBeGreaterThanOrEqual(1);
      // The bucket is the day in the timezone asked for, whatever the
      // database session's own timezone is.
      const todayResult = await pool.query<{ today: string }>(
        `SELECT (now() AT TIME ZONE 'America/Bogota')::date::text AS today`,
      );
      const today = todayResult.rows[0].today;
      expect(days.some((day) => day.date === today)).toBe(true);
    });

    it('getTopProducts() aggregates quantity and revenue per product', async () => {
      await createSale(4, 2500);

      const now = new Date();
      const dateFrom = new Date(now.getTime() - 60000).toISOString();
      const dateTo = new Date(now.getTime() + 60000).toISOString();

      const top = await repository.getTopProducts(
        businessId,
        branchId,
        dateFrom,
        dateTo,
        10,
      );
      const entry = top.find((row) => row.product_id === productId);
      expect(entry).toBeDefined();
      expect(parseFloat(entry?.quantity_sold ?? '0')).toBeGreaterThanOrEqual(4);
    });

    /** Moves an order's payment to a given instant, to place the sale on a known day. */
    async function soldAt(orderId: string, instant: string) {
      await pool.query(`UPDATE payments SET paid_at = $2 WHERE order_id = $1`, [
        orderId,
        instant,
      ]);
    }

    it("getSalesByDay() puts a late-night sale on the business's day, not the next UTC day", async () => {
      // 11:30 PM on March 3rd in Bogotá, already March 4th in UTC...
      await soldAt(await createSale(1, 7000), '2020-03-04T04:30:00Z');
      // ...and 12:30 AM on March 4th in Bogotá.
      await soldAt(await createSale(1, 9000), '2020-03-04T05:30:00Z');

      const range = [
        '2020-03-03T05:00:00Z',
        '2020-03-05T04:59:59.999Z',
      ] as const;
      const inBogota = await repository.getSalesByDay(
        businessId,
        branchId,
        ...range,
        'America/Bogota',
      );
      const inUtc = await repository.getSalesByDay(
        businessId,
        branchId,
        ...range,
        'UTC',
      );

      expect(
        inBogota.map((day) => [day.date, parseFloat(day.total_amount)]),
      ).toEqual([
        ['2020-03-03', 7000],
        ['2020-03-04', 9000],
      ]);
      expect(
        inUtc.map((day) => [day.date, parseFloat(day.total_amount)]),
      ).toEqual([['2020-03-04', 16000]]);
    });

    it('getTopProducts() ranks by revenue by default and by units when asked', async () => {
      // Few units of something expensive, many of something cheap.
      const cheap = await pool.query<{ id: string }>(
        `INSERT INTO products (branch_id, business_id, name, sale_price) VALUES ((SELECT id FROM branches WHERE business_id = $1 ORDER BY created_at, id LIMIT 1), $1, 'Agua', 1000) RETURNING id`,
        [businessId],
      );
      const expensive = await createSale(2, 30000);
      await soldAt(expensive, '2020-05-10T15:00:00Z');
      const cheapOrder = await repository.create(
        { businessId, branchId, orderType: OrderType.TAKEAWAY },
        undefined,
      );
      await repository.addItems(cheapOrder.id, [
        {
          productId: cheap.rows[0].id,
          quantity: 20,
          productNameSnapshot: 'Agua',
          productDescriptionSnapshot: null,
          unitPrice: 1000,
          unitCostSnapshot: 500,
          totalPrice: 20000,
          optionSelections: [],
        },
      ]);
      await repository.updateTotals(cheapOrder.id, 20000, 0, 0, 0, 20000);
      await pay(cheapOrder.id, 20000);
      await soldAt(cheapOrder.id, '2020-05-10T16:00:00Z');

      const range = ['2020-05-10T00:00:00Z', '2020-05-10T23:59:59Z'] as const;
      const byRevenue = await repository.getTopProducts(
        businessId,
        branchId,
        ...range,
        10,
      );
      const byQuantity = await repository.getTopProducts(
        businessId,
        branchId,
        ...range,
        10,
        'quantity',
      );

      expect(byRevenue.map((row) => row.product_name)).toEqual([
        'Burger',
        'Agua',
      ]);
      expect(byQuantity.map((row) => row.product_name)).toEqual([
        'Agua',
        'Burger',
      ]);
      expect(
        await repository.getTopProducts(
          businessId,
          branchId,
          ...range,
          1,
          'quantity',
        ),
      ).toHaveLength(1);
    });

    describe('what counts as a sale', () => {
      const day = ['2020-07-01T00:00:00Z', '2020-07-01T23:59:59Z'] as const;

      /** An order of 9000 that is neither delivered nor paid yet. */
      async function createOpenOrder(): Promise<string> {
        const order = await repository.create(
          { businessId, branchId, orderType: OrderType.TAKEAWAY },
          undefined,
        );
        await repository.updateTotals(order.id, 9000, 0, 0, 0, 9000);
        return order.id;
      }

      async function salesOfTheDay() {
        const summary = await repository.getSalesSummary(
          businessId,
          branchId,
          ...day,
        );
        return {
          count: parseInt(summary.order_count, 10),
          total: parseFloat(summary.total_amount ?? '0'),
        };
      }

      beforeEach(async () => {
        // Each case starts from an empty day.
        await pool.query(
          `UPDATE payments SET paid_at = '2019-01-01T12:00:00Z'
           WHERE paid_at BETWEEN $1 AND $2 AND order_id IN (SELECT id FROM orders WHERE business_id = $3)`,
          [...day, businessId],
        );
      });

      it('an order paid in full is a sale even before it is delivered', async () => {
        const order = await createOpenOrder();
        await pay(order, 9000);
        await soldAt(order, '2020-07-01T15:00:00Z');

        expect(await salesOfTheDay()).toEqual({ count: 1, total: 9000 });
      });

      it('an order delivered but not paid is not a sale', async () => {
        const order = await createOpenOrder();
        await repository.setStatus(
          order,
          businessId,
          OrderStatus.DELIVERED,
          'delivered_at',
        );
        await pool.query(
          `UPDATE orders SET delivered_at = '2020-07-01T15:00:00Z' WHERE id = $1`,
          [order],
        );

        expect(await salesOfTheDay()).toEqual({ count: 0, total: 0 });
      });

      it('a part payment is not a sale until the order is paid in full, and then it is one for the whole total', async () => {
        const order = await createOpenOrder();
        await pay(order, 4000, false);
        await soldAt(order, '2020-07-01T13:00:00Z');
        expect(await salesOfTheDay()).toEqual({ count: 0, total: 0 });

        await pay(order, 5000);
        expect(await salesOfTheDay()).toEqual({ count: 0, total: 0 });

        // The payment that completes it is what dates the sale.
        await pool.query(
          `UPDATE payments SET paid_at = '2020-07-01T18:00:00Z' WHERE order_id = $1 AND amount = 5000`,
          [order],
        );
        expect(await salesOfTheDay()).toEqual({ count: 1, total: 9000 });
      });

      it('a sale belongs to the day it was paid, not the day it was delivered', async () => {
        const order = await createSale(1, 4000);
        await soldAt(order, '2020-07-01T15:00:00Z');
        await pool.query(
          `UPDATE orders SET delivered_at = '2020-07-03T15:00:00Z' WHERE id = $1`,
          [order],
        );

        expect(await salesOfTheDay()).toEqual({ count: 1, total: 4000 });
      });

      it('a cancelled order is not a sale, even if it was paid', async () => {
        const order = await createSale(1, 6000);
        await soldAt(order, '2020-07-01T15:00:00Z');
        await pool.query(
          `UPDATE orders SET status = 'CANCELLED' WHERE id = $1`,
          [order],
        );

        expect(await salesOfTheDay()).toEqual({ count: 0, total: 0 });
      });

      it('the same rule decides the daily figures and the best-selling products', async () => {
        const paid = await createSale(3, 2000);
        await soldAt(paid, '2020-07-01T15:00:00Z');
        const unpaid = await createOpenOrder();
        await repository.addItems(unpaid, [
          {
            productId,
            quantity: 50,
            productNameSnapshot: 'Burger',
            productDescriptionSnapshot: null,
            unitPrice: 100,
            unitCostSnapshot: 50,
            totalPrice: 5000,
            optionSelections: [],
          },
        ]);
        await repository.setStatus(
          unpaid,
          businessId,
          OrderStatus.DELIVERED,
          'delivered_at',
        );
        await pool.query(
          `UPDATE orders SET delivered_at = '2020-07-01T16:00:00Z' WHERE id = $1`,
          [unpaid],
        );

        const days = await repository.getSalesByDay(
          businessId,
          branchId,
          ...day,
          'UTC',
        );
        const top = await repository.getTopProducts(
          businessId,
          branchId,
          ...day,
          10,
        );

        expect(days).toEqual([
          { date: '2020-07-01', order_count: '1', total_amount: '6000.00' },
        ]);
        expect(top).toHaveLength(1);
        expect(parseFloat(top[0].quantity_sold)).toBe(3);
      });
    });

    it('sales figures are scoped to the business and, when given, the branch', async () => {
      const order = await createSale(1, 5000);
      await soldAt(order, '2020-09-01T15:00:00Z');
      const range = ['2020-09-01T00:00:00Z', '2020-09-01T23:59:59Z'] as const;

      const ownBranch = await repository.getSalesSummary(
        businessId,
        branchId,
        ...range,
      );
      const wholeBusiness = await repository.getSalesSummary(
        businessId,
        undefined,
        ...range,
      );
      const otherBranch = await repository.getSalesSummary(
        businessId,
        randomUUID(),
        ...range,
      );
      const otherBusiness = await repository.getSalesSummary(
        randomUUID(),
        undefined,
        ...range,
      );

      expect(parseInt(ownBranch.order_count, 10)).toBe(1);
      expect(parseInt(wholeBusiness.order_count, 10)).toBe(1);
      expect(parseInt(otherBranch.order_count, 10)).toBe(0);
      expect(parseInt(otherBusiness.order_count, 10)).toBe(0);
    });
  });
});
