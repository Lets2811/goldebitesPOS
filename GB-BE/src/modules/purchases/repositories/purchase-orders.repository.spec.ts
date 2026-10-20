import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import { PurchaseOrdersRepository } from './purchase-orders.repository';

/**
 * Integration test against the real test database (golden_bites_test).
 * addItems() is a regression test for the multi-unnest() bulk-insert
 * pattern verified empirically via psql: repeated unnest() calls on
 * separate arrays zip in lockstep, so total_cost = quantity * unit_cost
 * must line up per row, not cross-multiply.
 */
describe('PurchaseOrdersRepository (integration)', () => {
  let pool: Pool;
  let db: DatabaseService;
  let repository: PurchaseOrdersRepository;
  let businessId: string;
  let branchId: string;
  let supplierId: string;
  let itemAId: string;
  let itemBId: string;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      database: 'golden_bites_test',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    db = new DatabaseService(pool);
    repository = new PurchaseOrdersRepository(db);

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

    const supplier = await pool.query<{ id: string }>(
      `INSERT INTO suppliers (business_id, name) VALUES ($1, $2) RETURNING id`,
      [businessId, `Test Supplier ${randomUUID()}`],
    );
    supplierId = supplier.rows[0].id;

    const items = await pool.query<{ id: string }>(
      `INSERT INTO inventory_items (branch_id, business_id, name, unit) VALUES ((SELECT id FROM branches WHERE business_id = $1 ORDER BY created_at, id LIMIT 1), $1, 'Flour', 'kg'), ((SELECT id FROM branches WHERE business_id = $1 ORDER BY created_at, id LIMIT 1), $1, 'Sugar', 'kg') RETURNING id`,
      [businessId],
    );
    itemAId = items.rows[0].id;
    itemBId = items.rows[1].id;
  });

  afterAll(async () => {
    await pool.query(
      'DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE business_id = $1)',
      [businessId],
    );
    await pool.query('DELETE FROM purchase_orders WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM inventory_items WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM suppliers WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM branches WHERE id = $1', [branchId]);
    await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);
    await pool.end();
  });

  it('create() generates a sequential PO-000123 style order number', async () => {
    const order = await repository.create(
      { businessId, branchId, supplierId },
      undefined,
    );

    expect(order.order_number).toMatch(/^PO-\d{6}$/);
  });

  it('addItems() zips multiple unnest() arrays in lockstep (regression)', async () => {
    const order = await repository.create(
      { businessId, branchId, supplierId },
      undefined,
    );

    await repository.addItems(order.id, [
      { inventoryItemId: itemAId, quantity: 2, unitCost: 10 },
      { inventoryItemId: itemBId, quantity: 3, unitCost: 20 },
    ]);

    const items = await repository.findItems(order.id);
    const itemA = items.find((item) => item.inventory_item_id === itemAId);
    const itemB = items.find((item) => item.inventory_item_id === itemBId);

    expect(itemA?.total_cost).toBe('20.00');
    expect(itemB?.total_cost).toBe('60.00');
  });

  it('findItems() derives received_quantity as 0 until a goods receipt exists', async () => {
    const order = await repository.create(
      { businessId, branchId, supplierId },
      undefined,
    );
    await repository.addItems(order.id, [
      { inventoryItemId: itemAId, quantity: 5, unitCost: 1 },
    ]);

    const items = await repository.findItems(order.id);
    expect(items[0].received_quantity).toBe('0');
  });

  it('findItems() sums received_quantity across multiple goods receipts', async () => {
    const order = await repository.create(
      { businessId, branchId, supplierId },
      undefined,
    );
    await repository.addItems(order.id, [
      { inventoryItemId: itemAId, quantity: 50, unitCost: 2 },
    ]);
    const [poItem] = await repository.findItems(order.id);

    const receipt = await pool.query<{ id: string }>(
      `INSERT INTO goods_receipts (business_id, branch_id, purchase_order_id) VALUES ($1, $2, $3) RETURNING id`,
      [businessId, branchId, order.id],
    );
    await pool.query(
      `INSERT INTO goods_receipt_items (goods_receipt_id, purchase_order_item_id, inventory_item_id, quantity_received, unit_cost)
       VALUES ($1, $2, $3, 20, 2), ($1, $2, $3, 10, 2)`,
      [receipt.rows[0].id, poItem.id, itemAId],
    );

    const items = await repository.findItems(order.id);
    expect(items[0].received_quantity).toBe('30.000');

    await pool.query(
      'DELETE FROM goods_receipt_items WHERE goods_receipt_id = $1',
      [receipt.rows[0].id],
    );
    await pool.query('DELETE FROM goods_receipts WHERE id = $1', [
      receipt.rows[0].id,
    ]);
  });

  it('hasReceipts() reflects whether any goods receipt references the order', async () => {
    const order = await repository.create(
      { businessId, branchId, supplierId },
      undefined,
    );
    expect(await repository.hasReceipts(order.id)).toBe(false);

    const receipt = await pool.query<{ id: string }>(
      `INSERT INTO goods_receipts (business_id, branch_id, purchase_order_id) VALUES ($1, $2, $3) RETURNING id`,
      [businessId, branchId, order.id],
    );
    expect(await repository.hasReceipts(order.id)).toBe(true);

    await pool.query('DELETE FROM goods_receipts WHERE id = $1', [
      receipt.rows[0].id,
    ]);
  });
});
