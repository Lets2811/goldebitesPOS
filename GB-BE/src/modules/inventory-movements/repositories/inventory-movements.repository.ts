import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { getOffset } from '../../../common/pagination/pagination.util';
import { DbClient } from '../../../database/types/database.types';
import {
  InventoryMovementRow,
  LowStockRow,
  StockRow,
} from '../domain/inventory-movement.interface';
import {
  MovementQuery,
  RecordMovementData,
  StockQuery,
} from '../domain/inventory-movement.types';
import { IInventoryMovementsRepository } from './inventory-movements.repository.interface';

const SELECT_COLUMNS = `id, business_id, branch_id, location_id, inventory_item_id, movement_type,
  quantity, unit_cost, reference_type, reference_id, notes, created_by, created_at`;

interface CountRow {
  count: string;
}

interface StockSumRow {
  stock: string | null;
}

@Injectable()
export class InventoryMovementsRepository implements IInventoryMovementsRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(
    data: RecordMovementData,
    client?: DbClient,
  ): Promise<InventoryMovementRow> {
    const result = await this.db.query<InventoryMovementRow>(
      `INSERT INTO inventory_movements
         (business_id, branch_id, location_id, inventory_item_id, movement_type, quantity,
          unit_cost, reference_type, reference_id, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${SELECT_COLUMNS}`,
      [
        data.businessId,
        data.branchId,
        data.locationId ?? null,
        data.inventoryItemId,
        data.movementType,
        data.quantity,
        data.unitCost ?? null,
        data.referenceType ?? null,
        data.referenceId ?? null,
        data.notes ?? null,
        data.createdBy ?? null,
      ],
      client,
    );
    return result.rows[0];
  }

  async findAll(
    query: MovementQuery,
  ): Promise<{ rows: InventoryMovementRow[]; total: number }> {
    const conditions: string[] = ['business_id = $1'];
    const params: unknown[] = [query.businessId];

    if (query.branchId) {
      params.push(query.branchId);
      conditions.push(`branch_id = $${params.length}`);
    }

    if (query.inventoryItemId) {
      params.push(query.inventoryItemId);
      conditions.push(`inventory_item_id = $${params.length}`);
    }

    if (query.movementType) {
      params.push(query.movementType);
      conditions.push(`movement_type = $${params.length}`);
    }

    if (query.dateFrom) {
      params.push(query.dateFrom);
      conditions.push(`created_at >= $${params.length}`);
    }

    if (query.dateTo) {
      params.push(query.dateTo);
      conditions.push(`created_at <= $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await this.db.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM inventory_movements WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataParams = [
      ...params,
      query.limit,
      getOffset(query.page, query.limit),
    ];
    const rowsResult = await this.db.query<InventoryMovementRow>(
      `SELECT ${SELECT_COLUMNS}
       FROM inventory_movements
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return { rows: rowsResult.rows, total };
  }

  async getStock(query: StockQuery): Promise<StockRow[]> {
    const conditions: string[] = ['business_id = $1'];
    const params: unknown[] = [query.businessId];

    if (query.branchId) {
      params.push(query.branchId);
      conditions.push(`branch_id = $${params.length}`);
    }

    if (query.locationId) {
      params.push(query.locationId);
      conditions.push(`location_id = $${params.length}`);
    }

    if (query.inventoryItemId) {
      params.push(query.inventoryItemId);
      conditions.push(`inventory_item_id = $${params.length}`);
    }

    const result = await this.db.query<StockRow>(
      `SELECT business_id, branch_id, location_id, inventory_item_id, stock::text AS stock
       FROM inventory_stock_view
       WHERE ${conditions.join(' AND ')}
       ORDER BY inventory_item_id`,
      params,
    );
    return result.rows;
  }

  async getStockForItem(
    businessId: string,
    branchId: string,
    inventoryItemId: string,
    client?: DbClient,
  ): Promise<number> {
    const result = await this.db.query<StockSumRow>(
      `SELECT SUM(stock)::text AS stock
       FROM inventory_stock_view
       WHERE business_id = $1 AND branch_id = $2 AND inventory_item_id = $3`,
      [businessId, branchId, inventoryItemId],
      client,
    );
    return parseFloat(result.rows[0]?.stock ?? '0');
  }

  async getLowStock(
    businessId: string,
    branchId?: string,
  ): Promise<LowStockRow[]> {
    const params: unknown[] = [businessId];
    let branchCondition = '';
    if (branchId) {
      params.push(branchId);
      branchCondition = ` AND ii.branch_id = $${params.length}`;
    }

    // Each item is its branch's and is measured by that branch's stock.
    const result = await this.db.query<LowStockRow>(
      `SELECT ii.id AS inventory_item_id, ii.name, ii.unit,
              ii.minimum_stock::text AS minimum_stock,
              COALESCE((
                SELECT SUM(sv.stock) FROM inventory_stock_view sv
                WHERE sv.business_id = ii.business_id AND sv.branch_id = ii.branch_id
                  AND sv.inventory_item_id = ii.id
              ), 0)::text AS current_stock,
              b.id AS branch_id, b.name AS branch_name
       FROM inventory_items ii
       JOIN branches b ON b.id = ii.branch_id AND b.is_active = true
       WHERE ii.business_id = $1 AND ii.deleted_at IS NULL AND ii.is_active = true${branchCondition}
         AND COALESCE((
           SELECT SUM(sv.stock) FROM inventory_stock_view sv
           WHERE sv.business_id = ii.business_id AND sv.branch_id = ii.branch_id
             AND sv.inventory_item_id = ii.id
         ), 0) < ii.minimum_stock
       ORDER BY ii.name, b.created_at`,
      params,
    );
    return result.rows;
  }

  async findByReference(
    referenceType: string,
    referenceId: string,
    client?: DbClient,
  ): Promise<InventoryMovementRow[]> {
    const result = await this.db.query<InventoryMovementRow>(
      `SELECT ${SELECT_COLUMNS} FROM inventory_movements
       WHERE reference_type = $1 AND reference_id = $2
       ORDER BY created_at`,
      [referenceType, referenceId],
      client,
    );
    return result.rows;
  }
}
