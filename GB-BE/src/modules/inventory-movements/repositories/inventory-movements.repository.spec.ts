import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import { InventoryMovementType } from '../domain/inventory-movement.types';
import { InventoryMovementsRepository } from './inventory-movements.repository';

/**
 * Integration test against the real test database (golden_bites_test).
 * Covers the inventory_stock_view aggregation (sign convention per
 * movement type) and the low-stock HAVING query — both depend on real
 * Postgres numeric behavior that mocks can't verify.
 */
describe('InventoryMovementsRepository (integration)', () => {
  let pool: Pool;
  let db: DatabaseService;
  let repository: InventoryMovementsRepository;
  let businessId: string;
  let branchId: string;

  async function createItem(minimumStock = 0): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO inventory_items (branch_id, business_id, name, unit, minimum_stock)
       VALUES ((SELECT id FROM branches WHERE business_id = $1 ORDER BY created_at, id LIMIT 1), $1, $2, 'kg', $3) RETURNING id`,
      [businessId, `Item ${randomUUID()}`, minimumStock],
    );
    return result.rows[0].id;
  }

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      database: 'golden_bites_test',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    db = new DatabaseService(pool);
    repository = new InventoryMovementsRepository(db);

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
  });

  afterAll(async () => {
    await pool.query('DELETE FROM inventory_movements WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM inventory_items WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM branches WHERE id = $1', [branchId]);
    await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);
    await pool.end();
  });

  it('the stock view sums inbound types positively and outbound types negatively', async () => {
    const itemId = await createItem();

    await repository.create({
      businessId,
      branchId,
      inventoryItemId: itemId,
      movementType: InventoryMovementType.PURCHASE,
      quantity: 100,
    });
    await repository.create({
      businessId,
      branchId,
      inventoryItemId: itemId,
      movementType: InventoryMovementType.SALE_CONSUMPTION,
      quantity: 30,
    });
    await repository.create({
      businessId,
      branchId,
      inventoryItemId: itemId,
      movementType: InventoryMovementType.WASTE,
      quantity: 5,
    });

    const stock = await repository.getStockForItem(
      businessId,
      branchId,
      itemId,
    );
    expect(stock).toBe(65);
  });

  it('getStock() aggregates decimal quantities correctly (regression: numeric precision)', async () => {
    const itemId = await createItem();

    await repository.create({
      businessId,
      branchId,
      inventoryItemId: itemId,
      movementType: InventoryMovementType.PURCHASE,
      quantity: 10.75,
    });
    await repository.create({
      businessId,
      branchId,
      inventoryItemId: itemId,
      movementType: InventoryMovementType.ADJUSTMENT_OUT,
      quantity: 0.25,
    });

    const rows = await repository.getStock({
      businessId,
      branchId,
      inventoryItemId: itemId,
    });
    expect(rows).toHaveLength(1);
    expect(parseFloat(rows[0].stock)).toBeCloseTo(10.5, 5);
  });

  it('getLowStock() only returns items below their minimum threshold', async () => {
    const lowItemId = await createItem(50);
    const healthyItemId = await createItem(5);

    await repository.create({
      businessId,
      branchId,
      inventoryItemId: lowItemId,
      movementType: InventoryMovementType.PURCHASE,
      quantity: 10,
    });
    await repository.create({
      businessId,
      branchId,
      inventoryItemId: healthyItemId,
      movementType: InventoryMovementType.PURCHASE,
      quantity: 10,
    });

    const alerts = await repository.getLowStock(businessId, branchId);
    const alertIds = alerts.map((alert) => alert.inventory_item_id);

    expect(alertIds).toContain(lowItemId);
    expect(alertIds).not.toContain(healthyItemId);
  });

  it('findAll() filters by movement type and paginates', async () => {
    const itemId = await createItem();
    await repository.create({
      businessId,
      branchId,
      inventoryItemId: itemId,
      movementType: InventoryMovementType.PURCHASE,
      quantity: 1,
    });
    await repository.create({
      businessId,
      branchId,
      inventoryItemId: itemId,
      movementType: InventoryMovementType.WASTE,
      quantity: 1,
    });

    const { rows } = await repository.findAll({
      businessId,
      page: 1,
      limit: 50,
      inventoryItemId: itemId,
      movementType: InventoryMovementType.WASTE,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].movement_type).toBe(InventoryMovementType.WASTE);
  });
});
