import type { OptionGroup, OptionSelection, ProductOptionGroup } from '../types/option-group.types';

/** Lo elegido en un ítem de pedido: ["Salsas: BBQ, Ajo", "Tamaño: Grande"]. */
export function formatOptionSelections(item: { optionSelections?: OptionSelection[] }): string[] {
  return (item.optionSelections ?? [])
    .filter((selection) => selection.itemNames.length > 0)
    .map((selection) => `${selection.groupName}: ${selection.itemNames.join(', ')}`);
}

/**
 * Los grupos que un producto deja elegir de verdad, en el orden del negocio:
 * solo los activos y con alguna opción activa.
 */
export function offeredGroups(
  product: { optionGroups: ProductOptionGroup[] },
  groups: OptionGroup[],
): { group: OptionGroup; maxChoices: number }[] {
  const maxByGroup = new Map(product.optionGroups.map((o) => [o.groupId, o.maxChoices]));
  return groups
    .filter((group) => group.isActive && maxByGroup.has(group.id) && group.items.some((item) => item.isActive))
    .map((group) => ({ group, maxChoices: maxByGroup.get(group.id)! }));
}

/** El encabezado de un selector: "Salsas (máx. 2)", "Tamaño (máx. 1 · obligatorio)". */
export function optionCaption(group: { name: string; isRequired: boolean }, max: number): string {
  return `${group.name} (máx. ${max}${group.isRequired ? ' · obligatorio' : ''})`;
}

/**
 * Para que concuerden los textos ("Nueva salsa", "Nuevo mezclador"): en
 * español, un nombre terminado en "a" casi siempre es femenino.
 */
export function isFeminineLabel(singularName: string): boolean {
  return /a$/i.test(singularName.trim());
}

/** "Sin salsas", "Sin hielo"... para quien decide no elegir. */
export function noneLabel(groupName: string): string {
  return `Sin ${groupName.toLocaleLowerCase('es')}`;
}

/** Marca o desmarca una opción respetando el máximo de su grupo. */
export function toggleOptionId(
  selectedIds: string[],
  group: OptionGroup,
  itemId: string,
  maxChoices: number,
): string[] {
  if (selectedIds.includes(itemId)) return selectedIds.filter((id) => id !== itemId);
  const inGroup = selectedIds.filter((id) => group.items.some((item) => item.id === id)).length;
  if (inGroup >= maxChoices) {
    // Con máximo 1, tocar otra la cambia en vez de no hacer nada.
    if (maxChoices === 1) {
      return [...selectedIds.filter((id) => !group.items.some((item) => item.id === id)), itemId];
    }
    return selectedIds;
  }
  return [...selectedIds, itemId];
}
