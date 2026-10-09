import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import { NfcTagsRepository } from './nfc-tags.repository';

/**
 * Integration test against the real test database (golden_bites_test).
 * Focuses on the DB-level guarantees the service relies on: the unique
 * (branch_id, table_number) index, and findActiveByToken()'s join filtering
 * on branch/business is_active — those are the real safety net, not just
 * the service-layer checks.
 */
describe('NfcTagsRepository (integration)', () => {
  let pool: Pool;
  let db: DatabaseService;
  let repository: NfcTagsRepository;
  let businessId: string;
  let branchId: string;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      database: 'golden_bites_test',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    db = new DatabaseService(pool);
    repository = new NfcTagsRepository(db);

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
    await pool.query('DELETE FROM nfc_tags WHERE business_id = $1', [businessId]);
    await pool.query('DELETE FROM branches WHERE business_id = $1', [businessId]);
    await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);
    await pool.end();
  });

  it('creates a gallo and finds it by id', async () => {
    const created = await repository.create({
      businessId,
      branchId,
      tableNumber: '1',
      name: 'Mesa 1',
      token: `tok-${randomUUID()}`,
    });

    const found = await repository.findById(created.id, businessId);
    expect(found?.table_number).toBe('1');
    expect(found?.is_active).toBe(true);
  });

  it('UNIQUE(branch_id, table_number): the DB itself rejects a second gallo for the same table', async () => {
    await repository.create({
      businessId,
      branchId,
      tableNumber: '2',
      name: 'Mesa 2',
      token: `tok-${randomUUID()}`,
    });

    await expect(
      pool.query(
        `INSERT INTO nfc_tags (business_id, branch_id, table_number, name, token) VALUES ($1, $2, '2', 'Mesa 2 duplicada', $3)`,
        [businessId, branchId, `tok-${randomUUID()}`],
      ),
    ).rejects.toThrow();
  });

  it('UNIQUE(token): the DB itself rejects a duplicate token', async () => {
    const sharedToken = `tok-${randomUUID()}`;
    await repository.create({ businessId, branchId, tableNumber: '3', name: 'Mesa 3', token: sharedToken });

    await expect(
      pool.query(
        `INSERT INTO nfc_tags (business_id, branch_id, table_number, name, token) VALUES ($1, $2, '4', 'Mesa 4', $3)`,
        [businessId, branchId, sharedToken],
      ),
    ).rejects.toThrow();
  });

  it('findActiveByToken() resolves an active gallo with an active branch/business', async () => {
    const token = `tok-${randomUUID()}`;
    await repository.create({ businessId, branchId, tableNumber: '5', name: 'Mesa 5', token });

    const resolved = await repository.findActiveByToken(token);
    expect(resolved).toEqual({
      businessId,
      branchId,
      businessName: expect.any(String),
      tableNumber: '5',
      selfServiceEnabled: true,
    });
  });

  it('setSelfService() turns self-service off, and the public resolution reflects it', async () => {
    const token = `tok-${randomUUID()}`;
    const created = await repository.create({ businessId, branchId, tableNumber: '50', name: 'Mesa 50', token });
    expect(created.self_service_enabled).toBe(true);

    const updated = await repository.setSelfService(created.id, businessId, false);
    expect(updated?.self_service_enabled).toBe(false);
    expect((await repository.findActiveByToken(token))?.selfServiceEnabled).toBe(false);

    expect(await repository.setSelfService(created.id, randomUUID(), true)).toBeNull();
  });

  it('findActiveByToken() returns null when the gallo itself is inactive', async () => {
    const token = `tok-${randomUUID()}`;
    const created = await repository.create({ businessId, branchId, tableNumber: '6', name: 'Mesa 6', token });
    await repository.setActive(created.id, businessId, false);

    expect(await repository.findActiveByToken(token)).toBeNull();
  });

  it('findActiveByToken() returns null when the branch is inactive, even if the gallo is active', async () => {
    const inactiveBranch = await pool.query<{ id: string }>(
      `INSERT INTO branches (business_id, name, is_active) VALUES ($1, $2, false) RETURNING id`,
      [businessId, `Inactive Branch ${randomUUID()}`],
    );
    const token = `tok-${randomUUID()}`;
    await repository.create({ businessId, branchId: inactiveBranch.rows[0].id, tableNumber: '1', name: 'Mesa 1', token });

    expect(await repository.findActiveByToken(token)).toBeNull();
  });

  it('findActiveByToken() returns null for an unknown token', async () => {
    expect(await repository.findActiveByToken('does-not-exist')).toBeNull();
  });

  it('existsForBranchTable() excludes the given id, so updating a gallo in place is not blocked by itself', async () => {
    const created = await repository.create({
      businessId,
      branchId,
      tableNumber: '7',
      name: 'Mesa 7',
      token: `tok-${randomUUID()}`,
    });

    expect(await repository.existsForBranchTable(branchId, '7')).toBe(true);
    expect(await repository.existsForBranchTable(branchId, '7', created.id)).toBe(false);
  });

  it('updateToken() replaces the token so the previous value no longer resolves', async () => {
    const oldToken = `tok-${randomUUID()}`;
    const created = await repository.create({ businessId, branchId, tableNumber: '8', name: 'Mesa 8', token: oldToken });

    const newToken = `tok-${randomUUID()}`;
    await repository.updateToken(created.id, businessId, newToken);

    expect(await repository.findActiveByToken(oldToken)).toBeNull();
    expect(await repository.findActiveByToken(newToken)).not.toBeNull();
  });
});
