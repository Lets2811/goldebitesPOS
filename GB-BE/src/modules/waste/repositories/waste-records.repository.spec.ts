import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import { WasteRecordsRepository } from './waste-records.repository';

/** Integration test against the real test database (golden_bites_test). */
describe('WasteRecordsRepository (integration)', () => {
  let pool: Pool;
  let db: DatabaseService;
  let repository: WasteRecordsRepository;
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
    repository = new WasteRecordsRepository(db);

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
      `INSERT INTO inventory_items (branch_id, business_id, name, unit) VALUES ((SELECT id FROM branches WHERE business_id = $1 ORDER BY created_at, id LIMIT 1), $1, 'Ice', 'kg') RETURNING id`,
      [businessId],
    );
    itemId = item.rows[0].id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM waste_records WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM inventory_items WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM branches WHERE id = $1', [branchId]);
    await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);
    await pool.end();
  });

  it('create() returns the inventory item name via the join', async () => {
    const record = await repository.create(
      {
        businessId,
        branchId,
        inventoryItemId: itemId,
        quantity: 2,
        reason: 'Melted',
      },
      1000,
      undefined,
    );

    expect(record.inventory_item_name).toBe('Ice');
    expect(record.quantity).toBe('2.000');
    expect(record.unit_cost).toBe('1000.00');
  });

  it('findAll() filters by date range', async () => {
    await repository.create(
      {
        businessId,
        branchId,
        inventoryItemId: itemId,
        quantity: 1,
        reason: 'Dropped',
      },
      null,
      undefined,
    );

    const future = new Date(Date.now() + 86400000).toISOString();
    const { rows, total } = await repository.findAll({
      businessId,
      page: 1,
      limit: 50,
      dateFrom: '2000-01-01',
      dateTo: future,
    });
    expect(total).toBeGreaterThanOrEqual(2);
    expect(rows.every((row) => row.business_id === businessId)).toBe(true);
  });
});
