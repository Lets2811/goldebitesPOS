import type { ProductOptionGroup } from '../types/option-group.types';
import { offeredGroups } from '../utils/option-group-utils';
import { useOptionGroups } from './use-option-groups';

interface CheckableLine {
  name: string;
  optionGroups: ProductOptionGroup[];
  optionItemIds: string[];
}

/**
 * Antes de enviar un pedido del personal: cada grupo obligatorio que ofrece un
 * producto debe llevar al menos una opción. Devuelve el mensaje del primer
 * faltante, o null. Un grupo sin nada activo para elegir no se exige (tampoco
 * lo hace el servidor).
 */
export function useRequiredOptionCheck(): (cart: CheckableLine[]) => string | null {
  const { groups } = useOptionGroups();

  return (cart) => {
    for (const line of cart) {
      for (const { group } of offeredGroups(line, groups)) {
        if (!group.isRequired) continue;
        const picked = group.items.some((item) => line.optionItemIds.includes(item.id));
        if (!picked) return `Elige ${group.name.toLocaleLowerCase('es')} para "${line.name}"`;
      }
    }
    return null;
  };
}
