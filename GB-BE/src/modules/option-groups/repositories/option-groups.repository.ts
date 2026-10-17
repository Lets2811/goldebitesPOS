import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { DbClient } from '../../../database/types/database.types';
import {
  CreateOptionGroupData,
  CreateOptionItemData,
  OptionGroupRow,
  OptionItemRow,
  ProductOptionGroup,
  ProductOptionGroupRow,
  UpdateOptionGroupData,
  UpdateOptionItemData,
} from '../domain/option-group.interface';
import { IOptionGroupsRepository } from './option-groups.repository.interface';

const GROUP_COLUMNS = `id, business_id, name, singular_name, is_active, is_required, default_max, display_order, created_at, updated_at`;
const ITEM_COLUMNS = `id, business_id, group_id, name, description, display_order, is_active, created_at, updated_at`;

interface CountRow {
  count: string;
}

@Injectable()
export class OptionGroupsRepository implements IOptionGroupsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findGroups(businessId: string): Promise<OptionGroupRow[]> {
    const result = await this.db.query<OptionGroupRow>(
      `SELECT ${GROUP_COLUMNS},
              (SELECT COUNT(*) FROM product_option_groups pog
               JOIN products p ON p.id = pog.product_id AND p.deleted_at IS NULL
               WHERE pog.group_id = option_groups.id) AS product_count
       FROM option_groups
       WHERE business_id = $1
       ORDER BY display_order, name`,
      [businessId],
    );
    return result.rows;
  }

  async findItems(businessId: string): Promise<OptionItemRow[]> {
    const result = await this.db.query<OptionItemRow>(
      `SELECT ${ITEM_COLUMNS} FROM option_items
       WHERE business_id = $1
       ORDER BY display_order, name`,
      [businessId],
    );
    return result.rows;
  }

  async findGroupById(
    businessId: string,
    id: string,
  ): Promise<OptionGroupRow | null> {
    const result = await this.db.query<OptionGroupRow>(
      `SELECT ${GROUP_COLUMNS} FROM option_groups WHERE id = $1 AND business_id = $2`,
      [id, businessId],
    );
    return result.rows[0] ?? null;
  }

  async findItemById(
    businessId: string,
    groupId: string,
    id: string,
  ): Promise<OptionItemRow | null> {
    const result = await this.db.query<OptionItemRow>(
      `SELECT ${ITEM_COLUMNS} FROM option_items
       WHERE id = $1 AND group_id = $2 AND business_id = $3`,
      [id, groupId, businessId],
    );
    return result.rows[0] ?? null;
  }

  async groupNameTaken(
    businessId: string,
    name: string,
    excludeId?: string,
  ): Promise<boolean> {
    const result = await this.db.query<CountRow>(
      `SELECT COUNT(*) AS count FROM option_groups
       WHERE business_id = $1 AND lower(name) = lower($2)
         AND ($3::uuid IS NULL OR id <> $3::uuid)`,
      [businessId, name, excludeId ?? null],
    );
    return Number(result.rows[0].count) > 0;
  }

  async itemNameTaken(
    groupId: string,
    name: string,
    excludeId?: string,
  ): Promise<boolean> {
    const result = await this.db.query<CountRow>(
      `SELECT COUNT(*) AS count FROM option_items
       WHERE group_id = $1 AND lower(name) = lower($2)
         AND ($3::uuid IS NULL OR id <> $3::uuid)`,
      [groupId, name, excludeId ?? null],
    );
    return Number(result.rows[0].count) > 0;
  }

  async createGroup(data: CreateOptionGroupData): Promise<OptionGroupRow> {
    // A new group goes last.
    const result = await this.db.query<OptionGroupRow>(
      `INSERT INTO option_groups (business_id, name, singular_name, is_required, default_max, display_order)
       VALUES ($1, $2, $3, COALESCE($4, false), COALESCE($5, 1),
               (SELECT COALESCE(MAX(display_order) + 1, 0) FROM option_groups WHERE business_id = $1))
       RETURNING ${GROUP_COLUMNS}`,
      [
        data.businessId,
        data.name,
        data.singularName,
        data.isRequired ?? null,
        data.defaultMax ?? null,
      ],
    );
    return result.rows[0];
  }

  async updateGroup(
    businessId: string,
    id: string,
    data: UpdateOptionGroupData,
  ): Promise<OptionGroupRow | null> {
    const result = await this.db.query<OptionGroupRow>(
      `UPDATE option_groups SET
         name = COALESCE($3, name),
         singular_name = COALESCE($4, singular_name),
         is_active = COALESCE($5, is_active),
         is_required = COALESCE($6, is_required),
         default_max = COALESCE($7::smallint, default_max),
         updated_at = now()
       WHERE id = $1 AND business_id = $2
       RETURNING ${GROUP_COLUMNS}`,
      [
        id,
        businessId,
        data.name ?? null,
        data.singularName ?? null,
        data.isActive ?? null,
        data.isRequired ?? null,
        data.defaultMax ?? null,
      ],
    );
    return result.rows[0] ?? null;
  }

  async countOwnedGroups(businessId: string, ids: string[]): Promise<number> {
    const result = await this.db.query<CountRow>(
      `SELECT COUNT(*) AS count FROM option_groups
       WHERE business_id = $1 AND id = ANY($2::uuid[])`,
      [businessId, ids],
    );
    return Number(result.rows[0].count);
  }

  async setGroupOrder(businessId: string, ids: string[]): Promise<void> {
    await this.db.query(
      `UPDATE option_groups g
       SET display_order = ordered.position - 1, updated_at = now()
       FROM unnest($2::uuid[]) WITH ORDINALITY AS ordered (id, position)
       WHERE g.id = ordered.id AND g.business_id = $1`,
      [businessId, ids],
    );
  }

  async createItem(data: CreateOptionItemData): Promise<OptionItemRow> {
    // Without an explicit position, a new option goes last in its group.
    const result = await this.db.query<OptionItemRow>(
      `INSERT INTO option_items (business_id, group_id, name, description, display_order)
       VALUES ($1, $2, $3, $4,
               COALESCE($5, (SELECT COALESCE(MAX(display_order) + 1, 0) FROM option_items WHERE group_id = $2)))
       RETURNING ${ITEM_COLUMNS}`,
      [
        data.businessId,
        data.groupId,
        data.name,
        data.description ?? null,
        data.displayOrder ?? null,
      ],
    );
    return result.rows[0];
  }

  async updateItem(
    businessId: string,
    groupId: string,
    id: string,
    data: UpdateOptionItemData,
  ): Promise<OptionItemRow | null> {
    const result = await this.db.query<OptionItemRow>(
      `UPDATE option_items SET
         name = COALESCE($4, name),
         description = CASE WHEN $5::boolean THEN $6 ELSE description END,
         display_order = COALESCE($7, display_order),
         is_active = COALESCE($8, is_active),
         updated_at = now()
       WHERE id = $1 AND group_id = $2 AND business_id = $3
       RETURNING ${ITEM_COLUMNS}`,
      [
        id,
        groupId,
        businessId,
        data.name ?? null,
        data.description !== undefined,
        data.description || null,
        data.displayOrder ?? null,
        data.isActive ?? null,
      ],
    );
    return result.rows[0] ?? null;
  }

  async deleteGroup(businessId: string, id: string): Promise<boolean> {
    // One statement: products stop offering it, its options go, then the
    // group (foreign keys are checked at the end of the statement).
    const result = await this.db.query<{ id: string }>(
      `WITH target AS (
         SELECT id FROM option_groups WHERE id = $1 AND business_id = $2
       ), unlinked AS (
         DELETE FROM product_option_groups WHERE group_id IN (SELECT id FROM target)
       ), items AS (
         DELETE FROM option_items WHERE group_id IN (SELECT id FROM target)
       )
       DELETE FROM option_groups WHERE id IN (SELECT id FROM target)
       RETURNING id`,
      [id, businessId],
    );
    return result.rows.length > 0;
  }

  async deleteItem(
    businessId: string,
    groupId: string,
    id: string,
  ): Promise<boolean> {
    const result = await this.db.query<{ id: string }>(
      `DELETE FROM option_items
       WHERE id = $1 AND group_id = $2 AND business_id = $3
       RETURNING id`,
      [id, groupId, businessId],
    );
    return result.rows.length > 0;
  }

  async findProductGroups(
    productIds: string[],
  ): Promise<ProductOptionGroupRow[]> {
    if (productIds.length === 0) return [];
    const result = await this.db.query<ProductOptionGroupRow>(
      `SELECT pog.product_id, pog.group_id, pog.max_choices
       FROM product_option_groups pog
       JOIN option_groups g ON g.id = pog.group_id
       WHERE pog.product_id = ANY($1::uuid[])
       ORDER BY g.display_order, g.name`,
      [productIds],
    );
    return result.rows;
  }

  async replaceProductGroups(
    productId: string,
    groups: ProductOptionGroup[],
    client?: DbClient,
  ): Promise<void> {
    await this.db.query(
      `DELETE FROM product_option_groups WHERE product_id = $1`,
      [productId],
      client,
    );
    if (groups.length === 0) return;
    await this.db.query(
      `INSERT INTO product_option_groups (product_id, group_id, max_choices)
       SELECT $1, g.group_id, g.max_choices
       FROM unnest($2::uuid[], $3::smallint[]) AS g (group_id, max_choices)`,
      [
        productId,
        groups.map((g) => g.groupId),
        groups.map((g) => g.maxChoices),
      ],
      client,
    );
  }
}
