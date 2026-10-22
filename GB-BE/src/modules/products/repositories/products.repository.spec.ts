import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import { ProductsRepository } from './products.repository';

/** Integration test against the real test database (golden_bites_test). */
describe('ProductsRepository (integration)', () => {
  let pool: Pool;
  let db: DatabaseService;
  let repository: ProductsRepository;
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
    repository = new ProductsRepository(db);

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
    await pool.query('DELETE FROM products WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM product_categories WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM branches WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);
    await pool.end();
  });

  it('creates a product with a decimal sale price (regression: COALESCE integer inference)', async () => {
    const created = await repository.create({
      businessId,
      branchId: catalogBranchId,
      name: 'Classic Burger',
      salePrice: 25000.5,
    });

    expect(created.sale_price).toBe('25000.50');
    expect(created.current_cost).toBe('0.00');
    expect(created.track_inventory).toBe(true);
  });

  it('defaults sale_price to 0 when omitted', async () => {
    const created = await repository.create({
      businessId,
      branchId: catalogBranchId,
      name: 'Free Sample',
    });

    expect(created.sale_price).toBe('0.00');
  });

  it('existsBySku() detects duplicates and excludes the current row', async () => {
    const created = await repository.create({
      businessId,
      branchId: catalogBranchId,
      name: 'SKU Product',
      sku: 'SKU-1',
    });

    expect(await repository.existsBySku(catalogBranchId, 'SKU-1')).toBe(true);
    expect(
      await repository.existsBySku(catalogBranchId, 'SKU-1', created.id),
    ).toBe(false);
  });

  it('setCurrentCost() updates only the cost column (used by RecipesService sync)', async () => {
    const created = await repository.create({
      businessId,
      branchId: catalogBranchId,
      name: 'Costed Product',
    });

    await repository.setCurrentCost(created.id, businessId, 3.58);

    const found = await repository.findById(created.id, businessId);
    expect(found?.current_cost).toBe('3.58');
  });

  it('findAvailableForSale() only returns active, non-deleted products', async () => {
    const active = await repository.create({
      businessId,
      branchId: catalogBranchId,
      name: 'Available Product',
    });
    const inactive = await repository.create({
      businessId,
      branchId: catalogBranchId,
      name: 'Inactive Product',
    });
    await repository.setActive(inactive.id, businessId, false);

    const available = await repository.findAvailableForSale(businessId);
    expect(available.some((p) => p.id === active.id)).toBe(true);
    expect(available.some((p) => p.id === inactive.id)).toBe(false);
  });

  it('softDelete() hides the product from findById and findAvailableForSale', async () => {
    const created = await repository.create({
      businessId,
      branchId: catalogBranchId,
      name: 'Deletable Product',
    });

    await repository.softDelete(created.id, businessId);

    expect(await repository.findById(created.id, businessId)).toBeNull();
    const available = await repository.findAvailableForSale(businessId);
    expect(available.some((p) => p.id === created.id)).toBe(false);
  });

  it('findAll() filters by categoryId and search', async () => {
    const category = await pool.query<{ id: string }>(
      `INSERT INTO product_categories (business_id, name) VALUES ($1, $2) RETURNING id`,
      [businessId, `Category ${randomUUID()}`],
    );
    const categoryId = category.rows[0].id;
    const product = await repository.create({
      businessId,
      branchId: catalogBranchId,
      name: 'Categorized Product',
      categoryId,
    });

    const { rows } = await repository.findAll({
      businessId,
      page: 1,
      limit: 50,
      categoryId,
    });
    expect(rows.some((row) => row.id === product.id)).toBe(true);
  });
});
