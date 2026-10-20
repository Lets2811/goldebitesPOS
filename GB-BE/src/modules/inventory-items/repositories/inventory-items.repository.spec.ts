import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import {
  InventoryQueryField,
  InventoryQueryIntent,
  InventoryQueryOperator,
} from '../domain/inventory-query.types';
import { InventoryItemsRepository } from './inventory-items.repository';

/**
 * Integration test against the real test database (golden_bites_test).
 * Also serves as a regression test for a real bug found in Phase 3: Postgres
 * infers untyped numeric literals in `COALESCE($n, 0)` as integer, which
 * rejected decimal values like 0.8 until the params were cast to ::numeric.
 */
describe('InventoryItemsRepository (integration)', () => {
  let pool: Pool;
  let db: DatabaseService;
  let repository: InventoryItemsRepository;
  let businessId: string;
  /** Products and items belong to a branch. */
  let catalogBranchId: string;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      database: 'golden_bites_test',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    db = new DatabaseService(pool);
    repository = new InventoryItemsRepository(db);

    const result = await pool.query<{ id: string }>(
      `INSERT INTO businesses (name) VALUES ($1) RETURNING id`,
      [`Test Business ${randomUUID()}`],
    );
    businessId = result.rows[0].id;
    const branch = await pool.query<{ id: string }>(
      `INSERT INTO branches (business_id, name) VALUES ($1, 'Catálogo') RETURNING id`,
      [businessId],
    );
    catalogBranchId = branch.rows[0].id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM inventory_movements WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM inventory_items WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query(
      'DELETE FROM inventory_item_categories WHERE business_id = $1',
      [businessId],
    );
    await pool.query('DELETE FROM branches WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);
    await pool.end();
  });

  it('creates an item with decimal minimumStock/currentCost without a type error', async () => {
    const created = await repository.create({
      businessId,
      branchId: catalogBranchId,
      name: 'Flour',
      unit: 'kg',
      minimumStock: 10.5,
      currentCost: 2.75,
    });

    expect(created.minimum_stock).toBe('10.500');
    expect(created.current_cost).toBe('2.75');
  });

  it('defaults minimumStock/currentCost to 0 when omitted (also decimal-safe)', async () => {
    const created = await repository.create({
      businessId,
      branchId: catalogBranchId,
      name: 'Salt',
      unit: 'kg',
    });

    expect(created.minimum_stock).toBe('0.000');
    expect(created.current_cost).toBe('0.00');
  });

  it('existsBySku() detects duplicates and excludes the current row', async () => {
    const item = await repository.create({
      businessId,
      branchId: catalogBranchId,
      name: 'Sugar',
      unit: 'kg',
      sku: 'SUG-1',
    });

    expect(await repository.existsBySku(catalogBranchId, 'SUG-1')).toBe(true);
    expect(
      await repository.existsBySku(catalogBranchId, 'SUG-1', item.id),
    ).toBe(false);
  });

  it('softDelete() hides the item from findById/findAll', async () => {
    const item = await repository.create({
      businessId,
      branchId: catalogBranchId,
      name: 'Butter',
      unit: 'kg',
    });

    const deleted = await repository.softDelete(item.id, businessId);
    expect(deleted?.deleted_at).not.toBeNull();

    expect(await repository.findById(item.id, businessId)).toBeNull();

    const { rows } = await repository.findAll({
      businessId,
      page: 1,
      limit: 50,
    });
    expect(rows.some((row) => row.id === item.id)).toBe(false);
  });

  it('update() applies partial changes with decimal values', async () => {
    const item = await repository.create({
      businessId,
      branchId: catalogBranchId,
      name: 'Oil',
      unit: 'l',
    });

    const updated = await repository.update(item.id, businessId, {
      currentCost: 6.99,
    });
    expect(updated?.current_cost).toBe('6.99');
    expect(updated?.name).toBe('Oil');
  });

  describe('queryAdvanced()', () => {
    let branchId: string;
    let categoryId: string;

    beforeAll(async () => {
      const branch = await pool.query<{ id: string }>(
        `INSERT INTO branches (business_id, name) VALUES ($1, $2) RETURNING id`,
        [businessId, `Test Branch ${randomUUID()}`],
      );
      branchId = branch.rows[0].id;

      const category = await pool.query<{ id: string }>(
        `INSERT INTO inventory_item_categories (business_id, name) VALUES ($1, $2) RETURNING id`,
        [businessId, `Bebidas ${randomUUID()}`],
      );
      categoryId = category.rows[0].id;
    });

    it('filters by category (equals) and computes currentStock from movements', async () => {
      const item = await repository.create({
        businessId,
        branchId: catalogBranchId,
        categoryId,
        name: `Soda ${randomUUID()}`,
        unit: 'unidad',
        minimumStock: 5,
      });
      await pool.query(
        `INSERT INTO inventory_movements (business_id, branch_id, inventory_item_id, movement_type, quantity)
         VALUES ($1, $2, $3, 'INITIAL_STOCK', 20)`,
        [businessId, branchId, item.id],
      );
      await pool.query(
        `INSERT INTO inventory_movements (business_id, branch_id, inventory_item_id, movement_type, quantity)
         VALUES ($1, $2, $3, 'ADJUSTMENT_OUT', 6)`,
        [businessId, branchId, item.id],
      );

      const { rows, total } = await repository.queryAdvanced({
        businessId,
        branchId,
        conditions: [
          {
            field: InventoryQueryField.CATEGORY_ID,
            operator: InventoryQueryOperator.EQUALS,
            value: categoryId,
          },
        ],
        intent: InventoryQueryIntent.DETAIL,
        page: 1,
        limit: 50,
      });

      const found = rows.find((row) => row.id === item.id);
      expect(found).toBeDefined();
      expect(found?.category_name).toContain('Bebidas');
      expect(found?.current_stock).toBe('14.000');
      expect(total).toBeGreaterThanOrEqual(1);
    });

    it('combines multiple conditions with AND (name contains + stock below minimum)', async () => {
      const uniqueTag = randomUUID().slice(0, 8);
      const lowStockItem = await repository.create({
        businessId,
        branchId: catalogBranchId,
        name: `Unique-${uniqueTag} Low`,
        unit: 'unidad',
        minimumStock: 100,
      });
      const highStockItem = await repository.create({
        businessId,
        branchId: catalogBranchId,
        name: `Unique-${uniqueTag} High`,
        unit: 'unidad',
        minimumStock: 1,
      });
      await pool.query(
        `INSERT INTO inventory_movements (business_id, branch_id, inventory_item_id, movement_type, quantity)
         VALUES ($1, $2, $3, 'INITIAL_STOCK', 5)`,
        [businessId, branchId, lowStockItem.id],
      );
      await pool.query(
        `INSERT INTO inventory_movements (business_id, branch_id, inventory_item_id, movement_type, quantity)
         VALUES ($1, $2, $3, 'INITIAL_STOCK', 500)`,
        [businessId, branchId, highStockItem.id],
      );

      const { rows } = await repository.queryAdvanced({
        businessId,
        branchId,
        conditions: [
          {
            field: InventoryQueryField.NAME,
            operator: InventoryQueryOperator.CONTAINS,
            value: uniqueTag,
          },
          {
            field: InventoryQueryField.CURRENT_STOCK,
            operator: InventoryQueryOperator.LESS_THAN,
            value: 10,
          },
        ],
        intent: InventoryQueryIntent.DETAIL,
        page: 1,
        limit: 50,
      });

      expect(rows.map((r) => r.id)).toEqual([lowStockItem.id]);
    });

    it('"isEmpty" matches items without a SKU', async () => {
      const withSku = await repository.create({
        businessId,
        branchId: catalogBranchId,
        name: `HasSku ${randomUUID()}`,
        unit: 'kg',
        sku: `SKU-${randomUUID()}`,
      });
      const withoutSku = await repository.create({
        businessId,
        branchId: catalogBranchId,
        name: `NoSku ${randomUUID()}`,
        unit: 'kg',
      });

      const { rows } = await repository.queryAdvanced({
        businessId,
        conditions: [
          {
            field: InventoryQueryField.SKU,
            operator: InventoryQueryOperator.IS_EMPTY,
          },
        ],
        intent: InventoryQueryIntent.DETAIL,
        page: 1,
        limit: 200,
      });

      const ids = rows.map((r) => r.id);
      expect(ids).toContain(withoutSku.id);
      expect(ids).not.toContain(withSku.id);
    });
  });

  describe('queryAggregate()', () => {
    let branchId: string;

    beforeAll(async () => {
      const branch = await pool.query<{ id: string }>(
        `INSERT INTO branches (business_id, name) VALUES ($1, $2) RETURNING id`,
        [businessId, `Aggregate Branch ${randomUUID()}`],
      );
      branchId = branch.rows[0].id;
    });

    it('COUNT / SUM_STOCK / TOTAL_VALUE / AVERAGE_COST match a manually computed baseline', async () => {
      const uniqueTag = randomUUID().slice(0, 8);
      const itemA = await repository.create({
        businessId,
        branchId: catalogBranchId,
        name: `Aggregate-${uniqueTag} A`,
        unit: 'unidad',
        currentCost: 10,
      });
      const itemB = await repository.create({
        businessId,
        branchId: catalogBranchId,
        name: `Aggregate-${uniqueTag} B`,
        unit: 'unidad',
        currentCost: 20,
      });
      await pool.query(
        `INSERT INTO inventory_movements (business_id, branch_id, inventory_item_id, movement_type, quantity)
         VALUES ($1, $2, $3, 'INITIAL_STOCK', 3)`,
        [businessId, branchId, itemA.id],
      );
      await pool.query(
        `INSERT INTO inventory_movements (business_id, branch_id, inventory_item_id, movement_type, quantity)
         VALUES ($1, $2, $3, 'INITIAL_STOCK', 7)`,
        [businessId, branchId, itemB.id],
      );

      const conditions = [
        {
          field: InventoryQueryField.NAME,
          operator: InventoryQueryOperator.CONTAINS,
          value: uniqueTag,
        },
      ];

      const count = await repository.queryAggregate({
        businessId,
        branchId,
        conditions,
        intent: InventoryQueryIntent.COUNT,
      });
      expect(count.value).toBe(2);

      const sumStock = await repository.queryAggregate({
        businessId,
        branchId,
        conditions,
        intent: InventoryQueryIntent.SUM_STOCK,
      });
      expect(sumStock.value).toBe(10);

      const totalValue = await repository.queryAggregate({
        businessId,
        branchId,
        conditions,
        intent: InventoryQueryIntent.TOTAL_VALUE,
      });
      expect(totalValue.value).toBe(3 * 10 + 7 * 20);

      const averageCost = await repository.queryAggregate({
        businessId,
        branchId,
        conditions,
        intent: InventoryQueryIntent.AVERAGE_COST,
      });
      expect(averageCost.value).toBe(15);
    });

    it('returns 0 for every aggregate when nothing matches', async () => {
      const conditions = [
        {
          field: InventoryQueryField.NAME,
          operator: InventoryQueryOperator.CONTAINS,
          value: `no-match-${randomUUID()}`,
        },
      ];

      const count = await repository.queryAggregate({
        businessId,
        conditions,
        intent: InventoryQueryIntent.COUNT,
      });
      expect(count.value).toBe(0);

      const totalValue = await repository.queryAggregate({
        businessId,
        conditions,
        intent: InventoryQueryIntent.TOTAL_VALUE,
      });
      expect(totalValue.value).toBe(0);
    });
  });
});
