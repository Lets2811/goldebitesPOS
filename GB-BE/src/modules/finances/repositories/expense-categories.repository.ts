import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  ExpenseCategoryRow,
  UpdateExpenseCategoryData,
} from '../domain/expense-category.interface';

const SELECT_COLUMNS = `id, business_id, code, name, is_cost_of_sales, is_active, sort_order, created_at, updated_at`;

export const EXPENSE_CATEGORIES_REPOSITORY = Symbol(
  'EXPENSE_CATEGORIES_REPOSITORY',
);

export interface IExpenseCategoriesRepository {
  findAll(businessId: string): Promise<ExpenseCategoryRow[]>;
  findById(id: string, businessId: string): Promise<ExpenseCategoryRow | null>;
  findByCode(
    businessId: string,
    code: string,
  ): Promise<ExpenseCategoryRow | null>;
  existsByName(
    businessId: string,
    name: string,
    excludeId?: string,
  ): Promise<boolean>;
  /** Gives a business the starting kinds. Safe to call again: the ones it already has are left alone. */
  insertDefaults(businessId: string): Promise<void>;
  create(data: {
    businessId: string;
    code: string;
    name: string;
    isCostOfSales: boolean;
  }): Promise<ExpenseCategoryRow>;
  update(
    id: string,
    businessId: string,
    data: UpdateExpenseCategoryData,
  ): Promise<ExpenseCategoryRow | null>;
  /** How many expenses, deleted or not, were recorded under a kind: its code must outlive it while any exist. */
  countExpenses(businessId: string, code: string): Promise<number>;
  delete(id: string, businessId: string): Promise<boolean>;
}

@Injectable()
export class ExpenseCategoriesRepository implements IExpenseCategoriesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(businessId: string): Promise<ExpenseCategoryRow[]> {
    const result = await this.db.query<ExpenseCategoryRow>(
      `SELECT ${SELECT_COLUMNS} FROM expense_categories WHERE business_id = $1 ORDER BY sort_order, name`,
      [businessId],
    );
    return result.rows;
  }

  async findById(
    id: string,
    businessId: string,
  ): Promise<ExpenseCategoryRow | null> {
    const result = await this.db.query<ExpenseCategoryRow>(
      `SELECT ${SELECT_COLUMNS} FROM expense_categories WHERE id = $1 AND business_id = $2`,
      [id, businessId],
    );
    return result.rows[0] ?? null;
  }

  async findByCode(
    businessId: string,
    code: string,
  ): Promise<ExpenseCategoryRow | null> {
    const result = await this.db.query<ExpenseCategoryRow>(
      `SELECT ${SELECT_COLUMNS} FROM expense_categories WHERE business_id = $1 AND code = $2`,
      [businessId, code],
    );
    return result.rows[0] ?? null;
  }

  async existsByName(
    businessId: string,
    name: string,
    excludeId?: string,
  ): Promise<boolean> {
    const result = await this.db.query<{ id: string }>(
      `SELECT id FROM expense_categories
       WHERE business_id = $1 AND lower(name) = lower($2) AND ($3::uuid IS NULL OR id != $3)`,
      [businessId, name, excludeId ?? null],
    );
    return result.rows.length > 0;
  }

  async insertDefaults(businessId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO expense_categories (business_id, code, name, is_cost_of_sales, sort_order)
       SELECT $1, d.code, d.name, d.is_cost_of_sales, d.sort_order
       FROM unnest($2::text[], $3::text[], $4::boolean[], $5::int[]) AS d (code, name, is_cost_of_sales, sort_order)
       ON CONFLICT DO NOTHING`,
      [
        businessId,
        DEFAULT_EXPENSE_CATEGORIES.map((category) => category.code),
        DEFAULT_EXPENSE_CATEGORIES.map((category) => category.name),
        DEFAULT_EXPENSE_CATEGORIES.map((category) => category.isCostOfSales),
        DEFAULT_EXPENSE_CATEGORIES.map((_, index) => index + 1),
      ],
    );
  }

  async create(data: {
    businessId: string;
    code: string;
    name: string;
    isCostOfSales: boolean;
  }): Promise<ExpenseCategoryRow> {
    const result = await this.db.query<ExpenseCategoryRow>(
      `INSERT INTO expense_categories (business_id, code, name, is_cost_of_sales, sort_order)
       VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM expense_categories WHERE business_id = $1))
       RETURNING ${SELECT_COLUMNS}`,
      [data.businessId, data.code, data.name, data.isCostOfSales],
    );
    return result.rows[0];
  }

  async update(
    id: string,
    businessId: string,
    data: UpdateExpenseCategoryData,
  ): Promise<ExpenseCategoryRow | null> {
    const result = await this.db.query<ExpenseCategoryRow>(
      `UPDATE expense_categories
       SET name = COALESCE($3, name),
           is_cost_of_sales = COALESCE($4, is_cost_of_sales),
           is_active = COALESCE($5, is_active)
       WHERE id = $1 AND business_id = $2
       RETURNING ${SELECT_COLUMNS}`,
      [
        id,
        businessId,
        data.name ?? null,
        data.isCostOfSales ?? null,
        data.isActive ?? null,
      ],
    );
    return result.rows[0] ?? null;
  }

  async countExpenses(businessId: string, code: string): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM expenses WHERE business_id = $1 AND category = $2`,
      [businessId, code],
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async delete(id: string, businessId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM expense_categories WHERE id = $1 AND business_id = $2`,
      [id, businessId],
    );
    return result.rowCount > 0;
  }
}
