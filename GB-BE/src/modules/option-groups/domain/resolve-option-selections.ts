import { BusinessRuleException } from '../../../common/exceptions';
import {
  OptionGroup,
  OptionSelection,
  ProductOptionGroup,
} from './option-group.interface';

/**
 * Checks what a customer picked on one order item against the business's
 * groups and what the product offers, and returns it grouped, in the groups'
 * display order, with today's names:
 *  - every pick is an active option of an active group the product offers;
 *  - no more picks in a group than the product allows;
 *  - a required group the product offers gets at least one pick, unless the
 *    group has nothing active to pick from.
 * Pure: `groups` is the business's whole catalog, loaded once per order.
 */
export function resolveOptionSelections(
  groups: OptionGroup[],
  offered: ProductOptionGroup[],
  pickedIds: string[],
  productName: string,
): OptionSelection[] {
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const itemById = new Map(
    groups.flatMap((group) =>
      group.items.map((item) => [item.id, item] as const),
    ),
  );
  const maxByGroup = new Map(offered.map((o) => [o.groupId, o.maxChoices]));

  const picked = new Map<string, string[]>();
  for (const id of new Set(pickedIds)) {
    const item = itemById.get(id);
    const group = item ? groupById.get(item.groupId) : undefined;
    if (!item || !group || !item.isActive || !group.isActive) {
      throw new BusinessRuleException(
        'Unknown or inactive option selected',
        'ORDER_ITEM_INVALID_OPTION',
      );
    }
    if (!maxByGroup.has(group.id)) {
      throw new BusinessRuleException(
        `Product "${productName}" does not take ${group.name.toLowerCase()}`,
        'ORDER_ITEM_OPTION_NOT_OFFERED',
      );
    }
    picked.set(group.id, [...(picked.get(group.id) ?? []), id]);
  }

  const selections: OptionSelection[] = [];
  const ordered = [...groups].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
  );
  for (const group of ordered) {
    const max = maxByGroup.get(group.id);
    if (max === undefined || !group.isActive) continue;
    const ids = picked.get(group.id) ?? [];
    if (ids.length > max) {
      throw new BusinessRuleException(
        `Product "${productName}" allows at most ${max} ${group.name.toLowerCase()}`,
        'ORDER_ITEM_TOO_MANY_OPTIONS',
      );
    }
    if (ids.length === 0) {
      if (group.isRequired && group.items.some((item) => item.isActive)) {
        throw new BusinessRuleException(
          `Product "${productName}" requires choosing ${group.name.toLowerCase()}`,
          'ORDER_ITEM_OPTION_REQUIRED',
        );
      }
      continue;
    }
    selections.push({
      groupId: group.id,
      groupName: group.name,
      itemIds: ids,
      itemNames: ids.map((id) => itemById.get(id)!.name),
    });
  }
  return selections;
}
