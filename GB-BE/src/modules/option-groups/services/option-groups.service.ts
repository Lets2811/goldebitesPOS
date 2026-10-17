import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleException,
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { DbClient } from '../../../database/types/database.types';
import { AuditService } from '../../audit/services/audit.service';
import {
  CreateOptionGroupData,
  CreateOptionItemData,
  OptionGroup,
  OptionGroupRow,
  OptionItem,
  OptionItemRow,
  ProductOptionGroup,
  UpdateOptionGroupData,
  UpdateOptionItemData,
} from '../domain/option-group.interface';
import { OPTION_GROUPS_REPOSITORY } from '../repositories/option-groups.repository.interface';
import type { IOptionGroupsRepository } from '../repositories/option-groups.repository.interface';

const toItem = (row: OptionItemRow): OptionItem => ({
  id: row.id,
  groupId: row.group_id,
  name: row.name,
  description: row.description,
  displayOrder: row.display_order,
  isActive: row.is_active,
});

const toGroup = (row: OptionGroupRow, items: OptionItem[]): OptionGroup => ({
  id: row.id,
  businessId: row.business_id,
  name: row.name,
  singularName: row.singular_name,
  isActive: row.is_active,
  isRequired: row.is_required,
  defaultMax: row.default_max,
  displayOrder: row.display_order,
  productCount: Number(row.product_count ?? 0),
  items,
});

/**
 * The groups of options each business offers on its products ("Salsas",
 * "Mezcladores", "Tamaño"...), their options, and which groups each product
 * offers.
 */
@Injectable()
export class OptionGroupsService {
  constructor(
    @Inject(OPTION_GROUPS_REPOSITORY)
    private readonly repository: IOptionGroupsRepository,
    private readonly auditService: AuditService,
  ) {}

  /** Every group of the business with all its options, active or not, in display order. */
  async findAll(businessId: string): Promise<OptionGroup[]> {
    const [groupRows, itemRows] = await Promise.all([
      this.repository.findGroups(businessId),
      this.repository.findItems(businessId),
    ]);
    const itemsByGroup = new Map<string, OptionItem[]>();
    for (const row of itemRows) {
      const list = itemsByGroup.get(row.group_id) ?? [];
      list.push(toItem(row));
      itemsByGroup.set(row.group_id, list);
    }
    return groupRows.map((row) => toGroup(row, itemsByGroup.get(row.id) ?? []));
  }

  async createGroup(
    data: CreateOptionGroupData,
    actorUserId?: string,
  ): Promise<OptionGroup> {
    const name = data.name.trim();
    await this.assertGroupNameFree(data.businessId, name);
    const row = await this.repository.createGroup({
      ...data,
      name,
      singularName: data.singularName.trim(),
    });
    await this.auditService.record({
      businessId: data.businessId,
      userId: actorUserId,
      entityType: 'option_group',
      entityId: row.id,
      action: 'CREATE',
      newValues: { name: row.name },
    });
    return toGroup(row, []);
  }

  async updateGroup(
    businessId: string,
    id: string,
    data: UpdateOptionGroupData,
    actorUserId?: string,
  ): Promise<OptionGroup> {
    const before = await this.getGroupOrFail(businessId, id);
    const name = data.name?.trim();
    if (name) await this.assertGroupNameFree(businessId, name, id);
    const row = await this.repository.updateGroup(businessId, id, {
      ...data,
      name,
      singularName: data.singularName?.trim(),
    });
    if (!row) throw new EntityNotFoundException('OptionGroup', id);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'option_group',
      entityId: id,
      action: 'UPDATE',
      oldValues: {
        name: before.name,
        singularName: before.singular_name,
        isActive: before.is_active,
        isRequired: before.is_required,
        defaultMax: before.default_max,
      },
      newValues: { ...data },
    });
    return this.findGroup(businessId, id);
  }

  /** The order groups show in: `groupIds` must be exactly the business's groups. */
  async setGroupOrder(
    businessId: string,
    groupIds: string[],
    actorUserId?: string,
  ): Promise<OptionGroup[]> {
    const groups = await this.repository.findGroups(businessId);
    const unique = new Set(groupIds);
    if (
      unique.size !== groupIds.length ||
      groupIds.length !== groups.length ||
      groups.some((group) => !unique.has(group.id))
    ) {
      throw new BusinessRuleException(
        'The order must list every option group of the business exactly once',
        'OPTION_GROUP_ORDER_MISMATCH',
      );
    }
    await this.repository.setGroupOrder(businessId, groupIds);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'option_group',
      entityId: businessId,
      action: 'REORDER',
      newValues: { groupIds },
    });
    return this.findAll(businessId);
  }

  async createItem(
    data: CreateOptionItemData,
    actorUserId?: string,
  ): Promise<OptionItem> {
    await this.getGroupOrFail(data.businessId, data.groupId);
    const name = data.name.trim();
    await this.assertItemNameFree(data.groupId, name);
    const row = await this.repository.createItem({ ...data, name });
    await this.auditService.record({
      businessId: data.businessId,
      userId: actorUserId,
      entityType: 'option_item',
      entityId: row.id,
      action: 'CREATE',
      newValues: { groupId: row.group_id, name: row.name },
    });
    return toItem(row);
  }

  async updateItem(
    businessId: string,
    groupId: string,
    id: string,
    data: UpdateOptionItemData,
    actorUserId?: string,
  ): Promise<OptionItem> {
    const before = await this.repository.findItemById(businessId, groupId, id);
    if (!before) throw new EntityNotFoundException('OptionItem', id);
    const name = data.name?.trim();
    if (name) await this.assertItemNameFree(groupId, name, id);
    const row = await this.repository.updateItem(businessId, groupId, id, {
      ...data,
      name,
    });
    if (!row) throw new EntityNotFoundException('OptionItem', id);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'option_item',
      entityId: id,
      action:
        data.isActive === undefined
          ? 'UPDATE'
          : data.isActive
            ? 'ACTIVATE'
            : 'DEACTIVATE',
      oldValues: { name: before.name, isActive: before.is_active },
      newValues: { ...data },
    });
    return toItem(row);
  }

  /**
   * Deletes a group for good: its options go with it and the products that
   * offered it stop offering it. Past orders keep what was picked (they store
   * the names), so nothing already sold changes.
   */
  async deleteGroup(
    businessId: string,
    id: string,
    actorUserId?: string,
  ): Promise<void> {
    const group = await this.findGroup(businessId, id);
    const deleted = await this.repository.deleteGroup(businessId, id);
    if (!deleted) throw new EntityNotFoundException('OptionGroup', id);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'option_group',
      entityId: id,
      action: 'DELETE',
      oldValues: {
        name: group.name,
        items: group.items.map((item) => item.name),
        productCount: group.productCount,
      },
    });
  }

  /** Deletes one option for good; past orders keep its name. */
  async deleteItem(
    businessId: string,
    groupId: string,
    id: string,
    actorUserId?: string,
  ): Promise<void> {
    const item = await this.repository.findItemById(businessId, groupId, id);
    if (!item) throw new EntityNotFoundException('OptionItem', id);
    await this.repository.deleteItem(businessId, groupId, id);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'option_item',
      entityId: id,
      action: 'DELETE',
      oldValues: { groupId, name: item.name },
    });
  }

  /** The groups each product offers, keyed by product id (products offering none are absent). */
  async getProductGroups(
    productIds: string[],
  ): Promise<Map<string, ProductOptionGroup[]>> {
    const rows = await this.repository.findProductGroups(productIds);
    const byProduct = new Map<string, ProductOptionGroup[]>();
    for (const row of rows) {
      const list = byProduct.get(row.product_id) ?? [];
      list.push({ groupId: row.group_id, maxChoices: row.max_choices });
      byProduct.set(row.product_id, list);
    }
    return byProduct;
  }

  /** Checks the groups belong to the business and aren't repeated, before a product is saved with them. */
  async assertProductGroupsValid(
    businessId: string,
    groups: ProductOptionGroup[],
  ): Promise<void> {
    if (groups.length === 0) return;
    const ids = groups.map((group) => group.groupId);
    if (new Set(ids).size !== ids.length) {
      throw new BusinessRuleException(
        'An option group can only be listed once per product',
        'PRODUCT_OPTION_GROUP_DUPLICATED',
      );
    }
    const owned = await this.repository.countOwnedGroups(businessId, ids);
    if (owned !== ids.length) {
      throw new BusinessRuleException(
        'Unknown option group',
        'PRODUCT_OPTION_GROUP_UNKNOWN',
      );
    }
  }

  /** Replaces the groups a product offers. Call assertProductGroupsValid first. */
  async setProductGroups(
    productId: string,
    groups: ProductOptionGroup[],
    client?: DbClient,
  ): Promise<void> {
    await this.repository.replaceProductGroups(productId, groups, client);
  }

  private async findGroup(
    businessId: string,
    id: string,
  ): Promise<OptionGroup> {
    const group = (await this.findAll(businessId)).find((g) => g.id === id);
    if (!group) throw new EntityNotFoundException('OptionGroup', id);
    return group;
  }

  private async getGroupOrFail(
    businessId: string,
    id: string,
  ): Promise<OptionGroupRow> {
    const row = await this.repository.findGroupById(businessId, id);
    if (!row) throw new EntityNotFoundException('OptionGroup', id);
    return row;
  }

  private async assertGroupNameFree(
    businessId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    if (await this.repository.groupNameTaken(businessId, name, excludeId)) {
      throw new ConflictException(
        `An option group named "${name}" already exists`,
        'OPTION_GROUP_NAME_TAKEN',
      );
    }
  }

  private async assertItemNameFree(
    groupId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    if (await this.repository.itemNameTaken(groupId, name, excludeId)) {
      throw new ConflictException(
        `"${name}" already exists in this group`,
        'OPTION_ITEM_NAME_TAKEN',
      );
    }
  }
}
