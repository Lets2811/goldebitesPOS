import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { getOffset } from '../../../common/pagination/pagination.util';
import { DbClient } from '../../../database/types/database.types';
import { InventoryItemRow } from '../domain/inventory-item.interface';
import {
  CreateInventoryItemData,
  InventoryItemQuery,
  UpdateInventoryItemData,
} from '../domain/inventory-item.types';
import {
  InventoryQueryAggregateResult,
  InventoryQueryCondition,
  InventoryQueryField,
  InventoryQueryIntent,
  InventoryQueryOperator,
  InventoryQueryResultRow,
  RunInventoryQueryData,
} from '../domain/inventory-query.types';
import { IInventoryItemsRepository } from './inventory-items.repository.interface';

/** Column/expression for each field — the ONLY thing ever interpolated into SQL for a query condition. */
const FIELD_COLUMN: Record<InventoryQueryField, string> = {
  [InventoryQueryField.NAME]: 'ii.name',
  [InventoryQueryField.SKU]: 'ii.sku',
  [InventoryQueryField.CATEGORY_ID]: 'ii.category_id',
  [InventoryQueryField.UNIT]: 'ii.unit',
  [InventoryQueryField.BRAND]: 'ii.brand',
  [InventoryQueryField.MODEL]: 'ii.model',
  [InventoryQueryField.SERIAL_NUMBER]: 'ii.serial_number',
  [InventoryQueryField.MINIMUM_STOCK]: 'ii.minimum_stock',
  [InventoryQueryField.CURRENT_COST]: 'ii.current_cost',
  [InventoryQueryField.CURRENT_STOCK]: 'COALESCE(stock.stock, 0)',
  [InventoryQueryField.IS_ACTIVE]: 'ii.is_active',
  [InventoryQueryField.CREATED_AT]: 'ii.created_at',
};

const SELECT_COLUMNS = `id, business_id, category_id, name, sku, unit, minimum_stock, current_cost, serial_number, brand, model, branch_id, is_active, created_at, updated_at, deleted_at`;

interface CountRow {
  count: string;
}

@Injectable()
export class InventoryItemsRepository implements IInventoryItemsRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(
    data: CreateInventoryItemData,
    client?: DbClient,
  ): Promise<InventoryItemRow> {
    const result = await this.db.query<InventoryItemRow>(
      `INSERT INTO inventory_items (business_id, category_id, name, sku, unit, minimum_stock, current_cost, serial_number, brand, model, branch_id)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::numeric, 0), COALESCE($7::numeric, 0), $8, $9, $10, $11)
       RETURNING ${SELECT_COLUMNS}`,
      [
        data.businessId,
        data.categoryId ?? null,
        data.name,
        data.sku ?? null,
        data.unit,
        data.minimumStock ?? null,
        data.currentCost ?? null,
        data.serialNumber ?? null,
        data.brand ?? null,
        data.model ?? null,
        data.branchId,
      ],
      client,
    );
    return result.rows[0];
  }

  async findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<InventoryItemRow | null> {
    const result = await this.db.query<InventoryItemRow>(
      `SELECT ${SELECT_COLUMNS} FROM inventory_items
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL`,
      [id, businessId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findAll(
    query: InventoryItemQuery,
  ): Promise<{ rows: InventoryItemRow[]; total: number }> {
    const conditions: string[] = ['business_id = $1', 'deleted_at IS NULL'];
    const params: unknown[] = [query.businessId];

    if (query.branchId) {
      params.push(query.branchId);
      conditions.push(`branch_id = $${params.length}`);
    }

    if (query.categoryId) {
      params.push(query.categoryId);
      conditions.push(`category_id = $${params.length}`);
    }

    if (query.isActive !== undefined) {
      params.push(query.isActive);
      conditions.push(`is_active = $${params.length}`);
    }

    if (query.search) {
      params.push(`%${query.search}%`);
      const idx = params.length;
      conditions.push(`(name ILIKE $${idx} OR sku ILIKE $${idx})`);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await this.db.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM inventory_items WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataParams = [
      ...params,
      query.limit,
      getOffset(query.page, query.limit),
    ];
    const rowsResult = await this.db.query<InventoryItemRow>(
      `SELECT ${SELECT_COLUMNS}
       FROM inventory_items
       WHERE ${whereClause}
       ORDER BY name
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return { rows: rowsResult.rows, total };
  }

  async update(
    id: string,
    businessId: string,
    data: UpdateInventoryItemData,
    client?: DbClient,
  ): Promise<InventoryItemRow | null> {
    const result = await this.db.query<InventoryItemRow>(
      `UPDATE inventory_items
       SET category_id = COALESCE($3, category_id),
           name = COALESCE($4, name),
           sku = COALESCE($5, sku),
           unit = COALESCE($6, unit),
           minimum_stock = COALESCE($7, minimum_stock),
           current_cost = COALESCE($8, current_cost),
           serial_number = COALESCE($9, serial_number),
           brand = COALESCE($10, brand),
           model = COALESCE($11, model)
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [
        id,
        businessId,
        data.categoryId ?? null,
        data.name ?? null,
        data.sku ?? null,
        data.unit ?? null,
        data.minimumStock ?? null,
        data.currentCost ?? null,
        data.serialNumber ?? null,
        data.brand ?? null,
        data.model ?? null,
      ],
      client,
    );
    return result.rows[0] ?? null;
  }

  async setActive(
    id: string,
    businessId: string,
    isActive: boolean,
  ): Promise<InventoryItemRow | null> {
    const result = await this.db.query<InventoryItemRow>(
      `UPDATE inventory_items SET is_active = $3
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, isActive],
    );
    return result.rows[0] ?? null;
  }

  async softDelete(
    id: string,
    businessId: string,
  ): Promise<InventoryItemRow | null> {
    const result = await this.db.query<InventoryItemRow>(
      `UPDATE inventory_items SET deleted_at = now()
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [id, businessId],
    );
    return result.rows[0] ?? null;
  }

  /** A SKU is unique within a branch's list. */
  async existsBySku(
    branchId: string,
    sku: string,
    excludeId?: string,
  ): Promise<boolean> {
    const result = await this.db.query<{ id: string }>(
      `SELECT id FROM inventory_items
       WHERE branch_id = $1 AND sku = $2 AND deleted_at IS NULL
         AND ($3::uuid IS NULL OR id != $3)`,
      [branchId, sku, excludeId ?? null],
    );
    return result.rows.length > 0;
  }

  async queryAdvanced(
    data: RunInventoryQueryData,
  ): Promise<{ rows: InventoryQueryResultRow[]; total: number }> {
    const { fromClause, params } = this.buildFromWhere(data);

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count ${fromClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataParams = [
      ...params,
      data.limit,
      getOffset(data.page, data.limit),
    ];
    const rowsResult = await this.db.query<InventoryQueryResultRow>(
      `SELECT ii.id, ii.category_id, cat.name AS category_name, ii.name, ii.sku, ii.unit,
              ii.minimum_stock, ii.current_cost, COALESCE(stock.stock, 0)::text AS current_stock,
              ii.serial_number, ii.brand, ii.model, ii.is_active, ii.created_at
       ${fromClause}
       ORDER BY ii.name
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return { rows: rowsResult.rows, total };
  }

  async queryAggregate(
    data: Omit<RunInventoryQueryData, 'page' | 'limit'>,
  ): Promise<InventoryQueryAggregateResult> {
    const { fromClause, params } = this.buildFromWhere(data);

    const AGGREGATE_EXPRESSION: Record<
      Exclude<InventoryQueryIntent, InventoryQueryIntent.DETAIL>,
      string
    > = {
      [InventoryQueryIntent.COUNT]: 'COUNT(*)',
      [InventoryQueryIntent.SUM_STOCK]:
        'COALESCE(SUM(COALESCE(stock.stock, 0)), 0)',
      [InventoryQueryIntent.TOTAL_VALUE]:
        'COALESCE(SUM(COALESCE(stock.stock, 0) * ii.current_cost), 0)',
      [InventoryQueryIntent.AVERAGE_COST]: 'COALESCE(AVG(ii.current_cost), 0)',
    };

    const expression =
      AGGREGATE_EXPRESSION[
        data.intent as Exclude<
          InventoryQueryIntent,
          InventoryQueryIntent.DETAIL
        >
      ];

    const result = await this.db.query<{ value: string }>(
      `SELECT ${expression}::text AS value ${fromClause}`,
      params,
    );

    return {
      intent: data.intent,
      value: parseFloat(result.rows[0]?.value ?? '0'),
    };
  }

  /** Shared FROM/JOIN/WHERE for both row listing and aggregation — never duplicate this. */
  private buildFromWhere(
    data: Pick<RunInventoryQueryData, 'businessId' | 'branchId' | 'conditions'>,
  ): { fromClause: string; params: unknown[] } {
    const conditions: string[] = [
      'ii.business_id = $1',
      'ii.deleted_at IS NULL',
    ];
    const params: unknown[] = [data.businessId];

    for (const condition of data.conditions) {
      conditions.push(this.buildConditionClause(condition, params));
    }

    const whereClause = conditions.join(' AND ');
    // params.length is captured now — condition-building above may have pushed several
    // params, so the stock subquery's own $1 (business_id) is safe to reuse, but the
    // branch filter (if any) needs its own placeholder appended after all conditions.
    let stockBranchFilter = '';
    if (data.branchId) {
      params.push(data.branchId);
      stockBranchFilter = ` AND branch_id = $${params.length}`;
    }

    const fromClause = `
      FROM inventory_items ii
      LEFT JOIN inventory_item_categories cat ON cat.id = ii.category_id
      LEFT JOIN (
        SELECT inventory_item_id, SUM(
          CASE WHEN movement_type IN ('PURCHASE', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'RETURN', 'INITIAL_STOCK')
            THEN quantity ELSE -quantity END
        ) AS stock
        FROM inventory_movements
        WHERE business_id = $1${stockBranchFilter}
        GROUP BY inventory_item_id
      ) stock ON stock.inventory_item_id = ii.id
      WHERE ${whereClause}
    `;

    return { fromClause, params };
  }

  /** Maps one already-validated condition to a SQL fragment, pushing its value(s) as params. */
  private buildConditionClause(
    condition: InventoryQueryCondition,
    params: unknown[],
  ): string {
    const column = FIELD_COLUMN[condition.field];

    switch (condition.operator) {
      case InventoryQueryOperator.EQUALS:
        params.push(condition.value);
        return `${column} = $${params.length}`;
      case InventoryQueryOperator.NOT_EQUALS:
        params.push(condition.value);
        return `${column} != $${params.length}`;
      case InventoryQueryOperator.CONTAINS:
        params.push(`%${condition.value}%`);
        return `${column} ILIKE $${params.length}`;
      case InventoryQueryOperator.STARTS_WITH:
        params.push(`${condition.value}%`);
        return `${column} ILIKE $${params.length}`;
      case InventoryQueryOperator.IS_EMPTY:
        return `(${column} IS NULL OR ${column}::text = '')`;
      case InventoryQueryOperator.IS_NOT_EMPTY:
        return `(${column} IS NOT NULL AND ${column}::text != '')`;
      case InventoryQueryOperator.GREATER_THAN:
        params.push(condition.value);
        return `${column} > $${params.length}`;
      case InventoryQueryOperator.GREATER_OR_EQUAL:
        params.push(condition.value);
        return `${column} >= $${params.length}`;
      case InventoryQueryOperator.LESS_THAN:
        params.push(condition.value);
        return `${column} < $${params.length}`;
      case InventoryQueryOperator.LESS_OR_EQUAL:
        params.push(condition.value);
        return `${column} <= $${params.length}`;
      case InventoryQueryOperator.BETWEEN:
        params.push(condition.value, condition.value2);
        return `${column} BETWEEN $${params.length - 1} AND $${params.length}`;
      case InventoryQueryOperator.IN:
        params.push(condition.values);
        return `${column} = ANY($${params.length}::uuid[])`;
    }
  }
}
