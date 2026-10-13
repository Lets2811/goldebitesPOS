import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DatabaseService } from '../../../database/database.service';
import { RecipesRepository } from './recipes.repository';

/** Integration test against the real test database (golden_bites_test). */
describe('RecipesRepository (integration)', () => {
  let pool: Pool;
  let db: DatabaseService;
  let repository: RecipesRepository;
  let businessId: string;
  let inventoryItemId: string;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      database: 'golden_bites_test',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    db = new DatabaseService(pool);
    repository = new RecipesRepository(db);

    const business = await pool.query<{ id: string }>(
      `INSERT INTO businesses (name) VALUES ($1) RETURNING id`,
      [`Test Business ${randomUUID()}`],
    );
    businessId = business.rows[0].id;

    const item = await pool.query<{ id: string }>(
      `INSERT INTO inventory_items (business_id, name, unit, current_cost) VALUES ($1, $2, 'kg', 18.5) RETURNING id`,
      [businessId, 'Beef'],
    );
    inventoryItemId = item.rows[0].id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM recipes WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM inventory_items WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM products WHERE business_id = $1', [
      businessId,
    ]);
    await pool.query('DELETE FROM businesses WHERE id = $1', [businessId]);
    await pool.end();
  });

  /** Each recipe needs its own product (UNIQUE(product_id) in the schema). */
  async function createProduct(): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO products (business_id, name, sale_price) VALUES ($1, $2, 10) RETURNING id`,
      [businessId, `Product ${randomUUID()}`],
    );
    return result.rows[0].id;
  }

  it('creates a recipe with a decimal yieldQuantity (regression: COALESCE integer inference)', async () => {
    const productId = await createProduct();

    const recipe = await repository.create({
      businessId,
      productId,
      name: 'Test Recipe',
      yieldQuantity: 2.5,
    });

    expect(recipe.yield_quantity).toBe('2.500');
  });

  it('defaults yieldQuantity to 1 when omitted', async () => {
    const productId = await createProduct();

    const recipe = await repository.create({
      businessId,
      productId,
      name: 'Default Yield Recipe',
    });

    expect(recipe.yield_quantity).toBe('1.000');
  });

  it('replaceItems() + findItemsWithDetails() + getTotalCost() compute cost correctly', async () => {
    const productId = await createProduct();
    const recipe = await repository.create({
      businessId,
      productId,
      name: 'Costed Recipe',
      yieldQuantity: 1,
    });

    await repository.replaceItems(recipe.id, [
      { inventoryItemId, quantity: 0.15 },
    ]);

    const items = await repository.findItemsWithDetails(recipe.id);
    expect(items).toHaveLength(1);
    expect(items[0].inventory_item_name).toBe('Beef');
    expect(items[0].unit_cost).toBe('18.50');

    const totalCost = await repository.getTotalCost(recipe.id);
    expect(totalCost).toBeCloseTo(0.15 * 18.5, 5);
  });

  it('replaceItems() fully replaces the previous set (no accumulation)', async () => {
    const productId = await createProduct();
    const recipe = await repository.create({
      businessId,
      productId,
      name: 'Replace Recipe',
    });

    await repository.replaceItems(recipe.id, [
      { inventoryItemId, quantity: 1 },
    ]);
    await repository.replaceItems(recipe.id, [
      { inventoryItemId, quantity: 3 },
    ]);

    const items = await repository.findItemsWithDetails(recipe.id);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe('3.000');
  });

  it('delete() cascades to recipe_items', async () => {
    const productId = await createProduct();
    const recipe = await repository.create({
      businessId,
      productId,
      name: 'Deletable Recipe',
    });
    await repository.replaceItems(recipe.id, [
      { inventoryItemId, quantity: 1 },
    ]);

    const deleted = await repository.delete(recipe.id, businessId);
    expect(deleted).toBe(true);

    expect(await repository.findById(recipe.id, businessId)).toBeNull();
    expect(await repository.findItemsWithDetails(recipe.id)).toHaveLength(0);
  });

  it('findByProductId() is scoped by business', async () => {
    const productId = await createProduct();
    await repository.create({ businessId, productId, name: 'Scoped Recipe' });

    expect(
      await repository.findByProductId(productId, businessId),
    ).not.toBeNull();
    expect(
      await repository.findByProductId(productId, randomUUID()),
    ).toBeNull();
  });
  describe('findInventoryLinksByProductIds()', () => {
    it('returns the items of several products in one go, and nothing for a product without a recipe', async () => {
      const single = await createProduct();
      const withoutRecipe = await createProduct();
      const recipe = await repository.create({
        businessId,
        productId: single,
        name: 'Single item',
        yieldQuantity: 4,
      });
      await repository.replaceItems(recipe.id, [
        { inventoryItemId, quantity: 0.6 },
      ]);

      const rows = await repository.findInventoryLinksByProductIds(businessId, [
        single,
        withoutRecipe,
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        product_id: single,
        inventory_item_id: inventoryItemId,
        inventory_item_name: 'Beef',
        unit: 'kg',
        quantity: '0.600',
        yield_quantity: '4.000',
        inventory_item_available: true,
      });
    });

    it('flags a link whose inventory item was deleted', async () => {
      const deleted = await pool.query<{ id: string }>(
        `INSERT INTO inventory_items (business_id, name, unit, deleted_at) VALUES ($1, 'Gone', 'kg', now()) RETURNING id`,
        [businessId],
      );
      const productId = await createProduct();
      const recipe = await repository.create({
        businessId,
        productId,
        name: 'Stale',
      });
      await repository.replaceItems(recipe.id, [
        { inventoryItemId: deleted.rows[0].id, quantity: 1 },
      ]);

      const rows = await repository.findInventoryLinksByProductIds(businessId, [
        productId,
      ]);

      expect(rows[0].inventory_item_available).toBe(false);
    });

    it('is scoped by business and makes no query for an empty list', async () => {
      const productId = await createProduct();
      const recipe = await repository.create({
        businessId,
        productId,
        name: 'Scoped',
      });
      await repository.replaceItems(recipe.id, [
        { inventoryItemId, quantity: 1 },
      ]);

      expect(
        await repository.findInventoryLinksByProductIds(randomUUID(), [
          productId,
        ]),
      ).toEqual([]);
      expect(
        await repository.findInventoryLinksByProductIds(businessId, []),
      ).toEqual([]);
    });
  });
});
