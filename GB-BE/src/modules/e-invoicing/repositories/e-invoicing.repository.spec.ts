import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import { EInvoicingRepository } from './e-invoicing.repository';

describe('EInvoicingRepository (integration)', () => {
  let pool: Pool;
  let repository: EInvoicingRepository;
  let businessId: string;
  let orderId: string;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      database: 'golden_bites_test',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    repository = new EInvoicingRepository(new DatabaseService(pool));
    businessId = (
      await pool.query<{ id: string }>(
        `INSERT INTO businesses (name) VALUES ($1) RETURNING id`,
        [`Test Business ${randomUUID()}`],
      )
    ).rows[0].id;
    const branchId = (
      await pool.query<{ id: string }>(
        `INSERT INTO branches (business_id, name) VALUES ($1, 'Sede') RETURNING id`,
        [businessId],
      )
    ).rows[0].id;
    orderId = (
      await pool.query<{ id: string }>(
        `INSERT INTO orders (business_id, branch_id, order_type, order_number)
         VALUES ($1, $2, 'TAKEAWAY', $3) RETURNING id`,
        [businessId, branchId, `T-${randomUUID().slice(0, 8)}`],
      )
    ).rows[0].id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM electronic_invoices WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query(
      'DELETE FROM e_invoicing_settings WHERE business_id = $1',
      [businessId],
    );
    await pool.query('DELETE FROM orders WHERE business_id = $1', [businessId]);
    await pool.query('DELETE FROM branches WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);
    await pool.end();
  });

  const base = () => ({
    businessId,
    orderId,
    referenceCode: `GB-${orderId}`.slice(0, 40),
    environment: 'SANDBOX' as const,
    customer: { kind: 'FINAL_CONSUMER' as const },
    createdBy: undefined,
  });

  it('keeps one row per order: a failed attempt, then the issued invoice over it', async () => {
    const failed = await repository.saveInvoice({
      ...base(),
      status: 'FAILED',
      number: null,
      cufe: null,
      qrUrl: null,
      publicUrl: null,
      total: null,
      errorMessage: 'customer: no válido',
      providerResponse: { message: 'Error de validación' },
    });
    expect(failed.status).toBe('FAILED');
    expect(failed.issued_at).toBeNull();

    const issued = await repository.saveInvoice({
      ...base(),
      status: 'ISSUED',
      number: 'SETP1',
      cufe: 'cufe-1',
      qrUrl: 'https://qr',
      publicUrl: 'https://pdf',
      total: 23760,
      errorMessage: null,
      providerResponse: { ok: true },
    });
    expect(issued.id).toBe(failed.id);
    expect(issued).toMatchObject({
      status: 'ISSUED',
      number: 'SETP1',
      total: '23760.00',
      error_message: null,
    });
    expect(issued.issued_at).toBeInstanceOf(Date);
    expect((await repository.findByOrder(businessId, orderId))?.number).toBe(
      'SETP1',
    );
  });

  it('stores and replaces the settings of a business', async () => {
    const settings = {
      environment: 'SANDBOX' as const,
      clientId: 'cid',
      clientSecretEncrypted: 'v1:a:b:c',
      username: 'u@x.co',
      passwordEncrypted: 'v1:d:e:f',
      numberingRangeId: 389,
      taxCode: '04' as const,
    };
    await repository.saveSettings(businessId, settings);
    await repository.saveSettings(businessId, {
      ...settings,
      environment: 'PRODUCTION',
      numberingRangeId: null,
    });

    const row = await repository.findSettings(businessId);
    expect(row).toMatchObject({
      environment: 'PRODUCTION',
      numbering_range_id: null,
      tax_code: '04',
    });
  });
});
