import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import { TableHelpRequestsRepository } from './table-help-requests.repository';

/**
 * Integration test against the real test database (golden_bites_test).
 * Focuses on what the SQL itself guarantees: one pending request per table,
 * and stale requests neither alerting forever nor blocking a new call.
 */
describe('TableHelpRequestsRepository (integration)', () => {
  let pool: Pool;
  let repository: TableHelpRequestsRepository;
  let businessId: string;
  let branchId: string;
  let otherBranchId: string;
  let userId: string;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      database: 'golden_bites_test',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    repository = new TableHelpRequestsRepository(new DatabaseService(pool));

    const business = await pool.query<{ id: string }>(
      `INSERT INTO businesses (name) VALUES ($1) RETURNING id`,
      [`Test Business ${randomUUID()}`],
    );
    businessId = business.rows[0].id;

    const branches = await pool.query<{ id: string }>(
      `INSERT INTO branches (business_id, name) VALUES ($1, $2), ($1, $3) RETURNING id`,
      [
        businessId,
        `Test Branch ${randomUUID()}`,
        `Test Branch ${randomUUID()}`,
      ],
    );
    branchId = branches.rows[0].id;
    otherBranchId = branches.rows[1].id;

    const user = await pool.query<{ id: string }>(
      `SELECT id FROM users LIMIT 1`,
    );
    userId = user.rows[0].id;
  });

  afterEach(async () => {
    await pool.query('DELETE FROM table_help_requests WHERE business_id = $1', [
      businessId,
    ]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM branches WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);
    await pool.end();
  });

  it('a second call from the same table returns the pending request instead of stacking another', async () => {
    const first = await repository.openForTable(businessId, branchId, '5');
    const second = await repository.openForTable(businessId, branchId, '5');

    expect(second.id).toBe(first.id);
    expect(second.created_at).toEqual(first.created_at);
    expect(await repository.findPending(businessId)).toHaveLength(1);
  });

  it('findPending() lists oldest first and filters by branch', async () => {
    const a = await repository.openForTable(businessId, branchId, '1');
    await pool.query(
      `UPDATE table_help_requests SET created_at = now() - interval '5 minutes' WHERE id = $1`,
      [a.id],
    );
    await repository.openForTable(businessId, branchId, '2');
    await repository.openForTable(businessId, otherBranchId, '1');

    const all = await repository.findPending(businessId);
    expect(all.map((row) => row.table_number)).toEqual(['1', '2', '1']);
    expect(all[0].id).toBe(a.id);

    const onlyOther = await repository.findPending(businessId, otherBranchId);
    expect(onlyOther).toHaveLength(1);
    expect(onlyOther[0].branch_id).toBe(otherBranchId);
  });

  it('markAttended() takes the request off the list, once, and lets the table call again', async () => {
    const request = await repository.openForTable(businessId, branchId, '5');

    const attended = await repository.markAttended(
      request.id,
      businessId,
      userId,
    );
    expect(attended?.attended_at).toBeInstanceOf(Date);
    expect(await repository.findPending(businessId)).toHaveLength(0);
    expect(
      await repository.markAttended(request.id, businessId, userId),
    ).toBeNull();

    const again = await repository.openForTable(businessId, branchId, '5');
    expect(again.id).not.toBe(request.id);
  });

  it('markAttended() ignores a request of another business', async () => {
    const request = await repository.openForTable(businessId, branchId, '5');

    expect(
      await repository.markAttended(request.id, randomUUID(), userId),
    ).toBeNull();
    expect(await repository.findPending(businessId)).toHaveLength(1);
  });

  it('a request nobody attended for hours stops being listed, and calling again renews it', async () => {
    const request = await repository.openForTable(businessId, branchId, '5');
    await pool.query(
      `UPDATE table_help_requests SET created_at = now() - interval '3 hours' WHERE id = $1`,
      [request.id],
    );

    expect(await repository.findPending(businessId)).toHaveLength(0);

    const renewed = await repository.openForTable(businessId, branchId, '5');
    expect(renewed.id).toBe(request.id);
    expect(await repository.findPending(businessId)).toHaveLength(1);
  });
});
