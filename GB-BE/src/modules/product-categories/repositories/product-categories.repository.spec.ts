import { CategoryOrderScope } from '../domain/product-category.types';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import { ProductCategoriesRepository } from './product-categories.repository';

/** Integration test against the real test database (golden_bites_test). */
describe('ProductCategoriesRepository (integration)', () => {
  let pool: Pool;
  let db: DatabaseService;
  let repository: ProductCategoriesRepository;
  let businessId: string;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      database: 'golden_bites_test',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    db = new DatabaseService(pool);
    repository = new ProductCategoriesRepository(db);

    const result = await pool.query<{ id: string }>(
      `INSERT INTO businesses (name) VALUES ($1) RETURNING id`,
      [`Test Business ${randomUUID()}`],
    );
    businessId = result.rows[0].id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM product_categories WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);
    await pool.end();
  });

  it('puts a new category last in both the menu and "Arma tu combo"', async () => {
    const first = await repository.create({ businessId, name: 'Burgers' });
    const second = await repository.create({ businessId, name: 'Postres' });

    expect(second.display_order).toBeGreaterThan(first.display_order);
    expect(second.builder_display_order).toBeGreaterThan(first.builder_display_order);
    expect(first.is_active).toBe(true);
  });

  it('setOrder() changes one list without touching the other', async () => {
    const a = await repository.create({ businessId, name: `A ${randomUUID()}` });
    const b = await repository.create({ businessId, name: `B ${randomUUID()}` });

    await repository.setOrder(businessId, CategoryOrderScope.BUILDER, [b.id, a.id]);

    const [reA, reB] = await Promise.all([repository.findById(a.id, businessId), repository.findById(b.id, businessId)]);
    expect(reB!.builder_display_order).toBeLessThan(reA!.builder_display_order);
    // The menu order is still the creation one: A before B.
    expect(reA!.display_order).toBeLessThan(reB!.display_order);
    expect(await repository.countOwned(businessId, [a.id, b.id, randomUUID()])).toBe(2);
  });

  it('findById() scopes by business', async () => {
    const created = await repository.create({ businessId, name: 'Drinks' });

    expect(await repository.findById(created.id, businessId)).not.toBeNull();
    expect(await repository.findById(created.id, randomUUID())).toBeNull();
  });

  it('existsByName() detects duplicates and excludes the current row', async () => {
    const created = await repository.create({ businessId, name: 'Desserts' });

    expect(await repository.existsByName(businessId, 'Desserts')).toBe(true);
    expect(
      await repository.existsByName(businessId, 'Desserts', created.id),
    ).toBe(false);
  });

  it('findAll() orders by display_order then name and supports search', async () => {
    await repository.create({
      businessId,
      name: 'Zebra Category',
      displayOrder: 1,
    });
    await repository.create({
      businessId,
      name: 'Alpha Category',
      displayOrder: 0,
    });

    const { rows } = await repository.findAll({
      businessId,
      page: 1,
      limit: 50,
      search: 'Category',
    });
    const names = rows.map((r) => r.name);
    expect(names.indexOf('Alpha Category')).toBeLessThan(
      names.indexOf('Zebra Category'),
    );
  });

  it('update() and setActive() apply partial changes', async () => {
    const created = await repository.create({ businessId, name: 'Sides' });

    const updated = await repository.update(created.id, businessId, {
      displayOrder: 5,
    });
    expect(updated?.display_order).toBe(5);
    expect(updated?.name).toBe('Sides');

    const deactivated = await repository.setActive(
      created.id,
      businessId,
      false,
    );
    expect(deactivated?.is_active).toBe(false);
  });
});
