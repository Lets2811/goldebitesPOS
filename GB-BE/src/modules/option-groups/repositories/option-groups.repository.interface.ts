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

export interface IOptionGroupsRepository {
  findGroups(businessId: string): Promise<OptionGroupRow[]>;
  findItems(businessId: string): Promise<OptionItemRow[]>;
  findGroupById(businessId: string, id: string): Promise<OptionGroupRow | null>;
  findItemById(
    businessId: string,
    groupId: string,
    id: string,
  ): Promise<OptionItemRow | null>;
  groupNameTaken(
    businessId: string,
    name: string,
    excludeId?: string,
  ): Promise<boolean>;
  itemNameTaken(
    groupId: string,
    name: string,
    excludeId?: string,
  ): Promise<boolean>;
  createGroup(data: CreateOptionGroupData): Promise<OptionGroupRow>;
  updateGroup(
    businessId: string,
    id: string,
    data: UpdateOptionGroupData,
  ): Promise<OptionGroupRow | null>;
  /** How many of `ids` are groups of this business. */
  countOwnedGroups(businessId: string, ids: string[]): Promise<number>;
  setGroupOrder(businessId: string, ids: string[]): Promise<void>;
  createItem(data: CreateOptionItemData): Promise<OptionItemRow>;
  updateItem(
    businessId: string,
    groupId: string,
    id: string,
    data: UpdateOptionItemData,
  ): Promise<OptionItemRow | null>;
  /** Deletes the group, its options, and the products' link to it. */
  deleteGroup(businessId: string, id: string): Promise<boolean>;
  deleteItem(businessId: string, groupId: string, id: string): Promise<boolean>;
  findProductGroups(productIds: string[]): Promise<ProductOptionGroupRow[]>;
  replaceProductGroups(
    productId: string,
    groups: ProductOptionGroup[],
    client?: DbClient,
  ): Promise<void>;
}

export const OPTION_GROUPS_REPOSITORY = Symbol('OPTION_GROUPS_REPOSITORY');
