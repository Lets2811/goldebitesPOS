import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import { GoodsReceiptsRepository } from './goods-receipts.repository';

/** Integration test against the real test database (golden_bites_test). */
describe('GoodsReceiptsRepository (integration)', () => {
  let pool: Pool;
  let db: DatabaseService;
  let repository: GoodsReceiptsRepository;
  let businessId: string;
  let branchId: string;
  let supplierId: string;
  let purchaseOrderId: string;
  let purchaseOrderItemId: string;
  let itemId: string;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      database: 'golden_bites_test',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    db = new DatabaseService(pool);
    repository = new GoodsReceiptsRepository(db);

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

    const item = await pool.query<{ id: string }>(
      `INSERT INTO inventory_items (branch_id, business_id, name, unit) VALUES ((SELECT id FROM branches WHERE business_id = $1 ORDER BY created_at, id LIMIT 1), $1, 'Flour', 'kg') RETURNING id`,
      [businessId],
    );
    itemId = item.rows[0].id;

    const order = await pool.query<{ id: string }>(
      `INSERT INTO purchase_orders (business_id, branch_id, supplier_id, order_number)
       VALUES ($1, $2, $3, 'PO-TEST01') RETURNING id`,
      [businessId, branchId, supplierId],
    );
    purchaseOrderId = order.rows[0].id;

    const orderItem = await pool.query<{ id: string }>(
      `INSERT INTO purchase_order_items (purchase_order_id, inventory_item_id, quantity, unit_cost, total_cost)
       VALUES ($1, $2, 50, 2.5, 125) RETURNING id`,
      [purchaseOrderId, itemId],
    );
    purchaseOrderItemId = orderItem.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(
      'DELETE FROM goods_receipt_items WHERE goods_receipt_id IN (SELECT id FROM goods_receipts WHERE business_id = $1)',
      [businessId],
    );
    await pool.query('DELETE FROM goods_receipts WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query(
      'DELETE FROM purchase_order_items WHERE purchase_order_id = $1',
      [purchaseOrderId],
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

  it('create() + addItems() persist a receipt with its lines via unnest()', async () => {
    const receipt = await repository.create(
      { businessId, branchId, purchaseOrderId },
      undefined,
    );

    await repository.addItems(receipt.id, [
      {
        purchaseOrderItemId,
        inventoryItemId: itemId,
        quantityReceived: 20,
        unitCost: 2.75,
      },
    ]);

    const items = await repository.findItems(receipt.id);
    expect(items).toHaveLength(1);
    expect(items[0].quantity_received).toBe('20.000');
    expect(items[0].unit_cost).toBe('2.75');
    expect(items[0].inventory_item_name).toBe('Flour');
  });

  it('findAll() filters by purchaseOrderId and paginates', async () => {
    const receipt = await repository.create(
      { businessId, branchId, purchaseOrderId },
      undefined,
    );
    await repository.addItems(receipt.id, [
      {
        purchaseOrderItemId,
        inventoryItemId: itemId,
        quantityReceived: 5,
        unitCost: 3,
      },
    ]);

    const { rows, total } = await repository.findAll({
      businessId,
      page: 1,
      limit: 50,
      purchaseOrderId,
    });

    expect(total).toBeGreaterThanOrEqual(1);
    expect(rows.every((row) => row.purchase_order_id === purchaseOrderId)).toBe(
      true,
    );
  });

  it('findById() is scoped by business', async () => {
    const receipt = await repository.create(
      { businessId, branchId, purchaseOrderId },
      undefined,
    );

    expect(await repository.findById(receipt.id, businessId)).not.toBeNull();
    expect(await repository.findById(receipt.id, randomUUID())).toBeNull();
  });
});
