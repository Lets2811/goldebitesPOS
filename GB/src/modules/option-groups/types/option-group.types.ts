/**
 * Lo que el cliente puede elegir en un producto, en grupos que cada negocio
 * define: Golden Bites tiene "Salsas" y "Acompañantes"; un bar puede tener
 * "Mezcladores", "Tamaño" y "Hielo". Refleja GB-BE (modules/option-groups).
 */
export interface OptionItem {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface OptionGroup {
  id: string;
  /** Plural, como se lee sobre las opciones: "Salsas". */
  name: string;
  /** "Salsa": para frases como "Nueva salsa". */
  singularName: string;
  isActive: boolean;
  /** El cliente debe elegir al menos una donde el producto ofrece el grupo. */
  isRequired: boolean;
  /** El máximo sugerido cuando un producto empieza a ofrecer el grupo. */
  defaultMax: number;
  displayOrder: number;
  /** Cuántos productos lo ofrecen: a cuáles afecta eliminarlo. */
  productCount: number;
  /** Todas sus opciones, activas o no, en orden. */
  items: OptionItem[];
}

/** Un grupo que ofrece un producto, y cuántas opciones de él se pueden elegir. */
export interface ProductOptionGroup {
  groupId: string;
  maxChoices: number;
}

/** Lo elegido de un grupo en un ítem de pedido, con los nombres de ese día. */
export interface OptionSelection {
  groupId: string;
  groupName: string;
  itemIds: string[];
  itemNames: string[];
}

export interface CreateOptionGroupPayload {
  name: string;
  singularName: string;
  isRequired?: boolean;
  defaultMax?: number;
}

export interface UpdateOptionGroupPayload extends Partial<CreateOptionGroupPayload> {
  isActive?: boolean;
}

export interface CreateOptionItemPayload {
  name: string;
  description?: string;
  displayOrder?: number;
}

export interface UpdateOptionItemPayload extends Partial<CreateOptionItemPayload> {
  isActive?: boolean;
}
