import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import { ExpensePaymentSource } from '../domain/expense.types';
import { SupplierPayableStatus, SupplierPaymentSource } from '../domain/supplier-payable.types';
import { ExpensesRepository } from './expenses.repository';
import { SupplierPayablesRepository } from './supplier-payables.repository';

/**
 * Integration test against the real test database (golden_bites_test). The
 * expense reports are cash basis for purchases on credit — a UNION of plain
 * expenses and supplier payments — and the payable's paid/pending amounts are
 * sums over its payments: both must be checked against real Postgres.
 */
describe('SupplierPayablesRepository + cash-basis expense reports (integration)', () => {
  let pool: Pool;
  let client: PoolClient;
  let expenses: ExpensesRepository;
  let payables: SupplierPayablesRepository;
  let businessId: string;
  let branchId: string;
  let supplierId: string;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      database: 'golden_bites_test',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    const db = new DatabaseService(pool);
    expenses = new ExpensesRepository(db);
    payables = new SupplierPayablesRepository(db);
    client = await pool.connect();

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
      `INSERT INTO suppliers (business_id, name, credit_days) VALUES ($1, 'Pollos El Campo', 30) RETURNING id`,
      [businessId],
    );
    supplierId = supplier.rows[0].id;
  });

  afterAll(async () => {
    client.release();
    await pool.query(
      `DELETE FROM supplier_payments WHERE business_id = $1`,
      [businessId],
    );
    await pool.query('DELETE FROM supplier_payables WHERE business_id = $1', [businessId]);
    await pool.query('DELETE FROM expenses WHERE business_id = $1', [businessId]);
    await pool.query('DELETE FROM suppliers WHERE business_id = $1', [businessId]);
    await pool.query('DELETE FROM branches WHERE business_id = $1', [businessId]);
    await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);
    await pool.end();
  });

  async function pay(payableId: string, amount: number, paymentDate: string) {
    await payables.insertPayment(
      {
        id: randomUUID(),
        payableId,
        businessId,
        branchId,
        amount,
        paymentDate,
        source: SupplierPaymentSource.BANK_ACCOUNT,
        createdBy: null as never,
      },
      client,
    );
  }

  it('counts a purchase on credit on the days it is paid, and a cash purchase on its own date', async () => {
    // Compra de contado: cuenta el día de la compra.
    await expenses.create(
      {
        businessId,
        branchId,
        category: 'OPERATING',
        name: 'Aseo',
        description: 'Productos de limpieza',
        responsible: 'Ana',
        amount: 50000,
        expenseDate: '2026-10-01',
        paymentSource: ExpensePaymentSource.BANK_ACCOUNT,
      },
      client,
    );
    // Compra a crédito de $800.000 el 1 oct: $300.000 ese día y $500.000 el 15 oct.
    const purchase = await expenses.create(
      {
        businessId,
        branchId,
        category: 'COGS',
        name: 'Pollo',
        description: 'Pollo para la semana',
        responsible: 'Ana',
        amount: 800000,
        expenseDate: '2026-10-01',
        paymentSource: ExpensePaymentSource.SUPPLIER_CREDIT,
        supplierId,
      },
      client,
    );
    const payableId = await payables.create(
      { businessId, expenseId: purchase.id, supplierId, originalAmount: 800000, dueDate: '2026-10-31' },
      client,
    );
    await pay(payableId, 300000, '2026-10-01');

    const range = { businessId, dateFrom: '2026-10-01', dateTo: '2026-10-31' };
    expect(await expenses.getDailyTotals(range)).toEqual([{ date: '2026-10-01', total: '350000.00' }]);

    const open = await payables.findById(payableId, businessId);
    expect(open).toEqual(
      expect.objectContaining({
        supplier_name: 'Pollos El Campo',
        original_amount: '800000.00',
        paid_amount: '300000.00',
        due_date: '2026-10-31',
        purchase_date: '2026-10-01',
      }),
    );

    await pay(payableId, 500000, '2026-10-15');
    expect(await expenses.getDailyTotals(range)).toEqual([
      { date: '2026-10-01', total: '350000.00' },
      { date: '2026-10-15', total: '500000.00' },
    ]);

    const byCategory = await expenses.getSummaryByCategory(range);
    expect(Object.fromEntries(byCategory.map((row) => [row.category, row.total]))).toEqual({
      COGS: '800000.00',
      OPERATING: '50000.00',
    });

    // Un pago en noviembre no cuenta en octubre.
    expect(await expenses.getDailyTotals({ businessId, dateFrom: '2026-10-16', dateTo: '2026-10-31' })).toEqual([]);
  });

  it('adds up what is still owed and what is overdue', async () => {
    const purchase = await expenses.create(
      {
        businessId,
        branchId,
        category: 'COGS',
        name: 'Carne',
        description: 'Carne de res',
        responsible: 'Ana',
        amount: 200000,
        expenseDate: '2026-09-01',
        paymentSource: ExpensePaymentSource.SUPPLIER_CREDIT,
        supplierId,
      },
      client,
    );
    const payableId = await payables.create(
      { businessId, expenseId: purchase.id, supplierId, originalAmount: 200000, dueDate: '2026-09-30' },
      client,
    );
    await pay(payableId, 50000, '2026-09-10');
    await payables.setStatus(payableId, SupplierPayableStatus.PARTIALLY_PAID, client);

    const summary = await payables.getSummary(businessId, '2026-10-14');
    expect(summary).toEqual({
      // Los totales incluyen lo que dejó abierto el otro test; aquí importa lo vencido: solo la carne.
      pending_total: expect.any(String),
      open_count: expect.any(String),
      overdue_total: '150000.00',
      overdue_count: '1',
    });

    const openOnly = await payables.findAll({ businessId, openOnly: true });
    expect(openOnly.map((row) => row.id)).toContain(payableId);
    expect(await payables.countPayments(payableId)).toBe(1);
  });
});
