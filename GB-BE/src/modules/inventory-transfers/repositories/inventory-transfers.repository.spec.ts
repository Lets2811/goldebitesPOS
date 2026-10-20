import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import { TransferStatus } from '../domain/inventory-transfer.interface';
import { InventoryTransfersRepository } from './inventory-transfers.repository';

/**
 * Integration test against the real test database (golden_bites_test).
 * setStatus() is a regression test for a real bug found during Phase 4
 * smoke testing: Postgres inferred $3 as `text` from the CASE...IN literal
 * comparison and as `character varying(30)` from the `status = $3`
 * assignment in the same statement, raising "inconsistent types deduced
 * for parameter $3" until the IN-comparison was cast to `::varchar` to
 * match the column type (a plain `::text` cast still conflicted).
 */
describe('InventoryTransfersRepository (integration)', () => {
  let pool: Pool;
  let db: DatabaseService;
  let repository: InventoryTransfersRepository;
  let businessId: string;
  let fromBranchId: string;
  let toBranchId: string;
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
    repository = new InventoryTransfersRepository(db);

    const business = await pool.query<{ id: string }>(
      `INSERT INTO businesses (name) VALUES ($1) RETURNING id`,
      [`Test Business ${randomUUID()}`],
    );
    businessId = business.rows[0].id;

    const branches = await pool.query<{ id: string }>(
      `INSERT INTO branches (business_id, name) VALUES ($1, 'From'), ($1, 'To') RETURNING id`,
      [businessId],
    );
    fromBranchId = branches.rows[0].id;
    toBranchId = branches.rows[1].id;

    const item = await pool.query<{ id: string }>(
      `INSERT INTO inventory_items (branch_id, business_id, name, unit) VALUES ((SELECT id FROM branches WHERE business_id = $1 ORDER BY created_at, id LIMIT 1), $1, 'Flour', 'kg') RETURNING id`,
      [businessId],
    );
    itemId = item.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(
      'DELETE FROM inventory_transfer_items WHERE transfer_id IN (SELECT id FROM inventory_transfers WHERE business_id = $1)',
      [businessId],
    );
    await pool.query('DELETE FROM inventory_transfers WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM inventory_items WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM branches WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);
    await pool.end();
  });

  it('addItems() bulk-inserts via unnest() with quantities zipped correctly', async () => {
    const transfer = await repository.create(
      { businessId, fromBranchId, toBranchId },
      undefined,
    );

    await repository.addItems(transfer.id, [
      { inventoryItemId: itemId, quantity: 12.5 },
    ]);

    const items = await repository.findItems(transfer.id);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe('12.500');
    expect(items[0].inventory_item_name).toBe('Flour');
  });

  it('setStatus() transitions to COMPLETED and stamps completed_at', async () => {
    const transfer = await repository.create(
      { businessId, fromBranchId, toBranchId },
      undefined,
    );

    const updated = await repository.setStatus(
      transfer.id,
      businessId,
      TransferStatus.COMPLETED,
      undefined,
    );

    expect(updated?.status).toBe(TransferStatus.COMPLETED);
    expect(updated?.completed_at).not.toBeNull();
  });

  it('setStatus() leaves completed_at untouched for non-terminal statuses', async () => {
    const transfer = await repository.create(
      { businessId, fromBranchId, toBranchId },
      undefined,
    );

    const updated = await repository.setStatus(
      transfer.id,
      businessId,
      TransferStatus.PENDING,
      undefined,
    );

    expect(updated?.completed_at).toBeNull();
  });
});
