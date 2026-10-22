import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import { CountStatus } from '../domain/inventory-count.interface';
import { InventoryCountsRepository } from './inventory-counts.repository';

/**
 * Integration test against the real test database (golden_bites_test).
 * setStatus() is a regression test for the same Postgres parameter
 * type-inference bug fixed in InventoryTransfersRepository: the CASE...IN
 * comparison must be cast to `::varchar` (matching the `status` column
 * type) or Postgres raises "inconsistent types deduced for parameter $3".
 */
describe('InventoryCountsRepository (integration)', () => {
  let pool: Pool;
  let db: DatabaseService;
  let repository: InventoryCountsRepository;
  let businessId: string;
  let branchId: string;
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
    repository = new InventoryCountsRepository(db);

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

    const item = await pool.query<{ id: string }>(
      `INSERT INTO inventory_items (branch_id, business_id, name, unit) VALUES ((SELECT id FROM branches WHERE business_id = $1 ORDER BY created_at, id LIMIT 1), $1, 'Flour', 'kg') RETURNING id`,
      [businessId],
    );
    itemId = item.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(
      'DELETE FROM inventory_count_items WHERE count_id IN (SELECT id FROM inventory_counts WHERE business_id = $1)',
      [businessId],
    );
    await pool.query('DELETE FROM inventory_counts WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM inventory_items WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM branches WHERE id = $1', [branchId]);
    await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);
    await pool.end();
  });

  it('addItems() bulk-inserts expected quantities via unnest()', async () => {
    const count = await repository.create({
      businessId,
      branchId,
      inventoryItemIds: [itemId],
    });

    await repository.addItems(count.id, [
      { inventoryItemId: itemId, expectedQuantity: 80.5 },
    ]);

    const items = await repository.findItems(count.id);
    expect(items).toHaveLength(1);
    expect(items[0].expected_quantity).toBe('80.500');
    expect(items[0].counted_quantity).toBeNull();
  });

  it('recordCountedQuantity() sets counted_quantity and counted_at', async () => {
    const count = await repository.create({
      businessId,
      branchId,
      inventoryItemIds: [itemId],
    });
    await repository.addItems(count.id, [
      { inventoryItemId: itemId, expectedQuantity: 100 },
    ]);

    await repository.recordCountedQuantity(count.id, itemId, 75);

    const item = await repository.findItem(count.id, itemId);
    expect(item?.counted_quantity).toBe('75.000');
    expect(item?.counted_at).not.toBeNull();
  });

  it('setStatus() transitions to COMPLETED without a Postgres type error', async () => {
    const count = await repository.create({
      businessId,
      branchId,
      inventoryItemIds: [itemId],
    });

    const updated = await repository.setStatus(
      count.id,
      businessId,
      CountStatus.COMPLETED,
      undefined,
    );

    expect(updated?.status).toBe(CountStatus.COMPLETED);
    expect(updated?.completed_at).not.toBeNull();
  });

  it('setStatus() to a non-terminal status leaves completed_at null', async () => {
    const count = await repository.create({
      businessId,
      branchId,
      inventoryItemIds: [itemId],
    });

    const updated = await repository.setStatus(
      count.id,
      businessId,
      CountStatus.IN_PROGRESS,
      undefined,
    );

    expect(updated?.completed_at).toBeNull();
  });
});
