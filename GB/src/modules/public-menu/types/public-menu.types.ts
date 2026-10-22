export interface PublicMenuProduct {
  id: string;
  name: string;
  salePrice: number;
  description: string | null;
  imageUrl: string | null;
  /** Cuáles de los `optionGroups` del menú ofrece el producto, y cuántas opciones de cada uno se eligen. */
  optionGroups: { groupId: string; maxChoices: number }[];
}

export interface PublicMenuCategory {
  id: string | null;
  name: string;
  products: PublicMenuProduct[];
}

export interface PublicMenuOption {
  id: string;
  name: string;
}

/** Un grupo de opciones para elegir ("Salsas", "Tamaño"...), con sus opciones activas. */
export interface PublicMenuOptionGroup {
  id: string;
  name: string;
  singularName: string;
  /** Hay que elegir al menos una donde el producto ofrece el grupo. */
  isRequired: boolean;
  items: PublicMenuOption[];
}

export interface PublicMenu {
  businessName: string;
  /** El menú normal: productos marcados "Solo menú" o "Ambos". */
  categories: PublicMenuCategory[];
  /** "Arma tu combo": productos marcados "Solo arma tu combo" o "Ambos", por categoría. Vacío si no se ofrece. */
  builderCategories: PublicMenuCategory[];
  /** Cómo llama el negocio a "Arma tu combo", y la frase debajo (con los valores por defecto ya puestos). */
  builderName: string;
  builderDescription: string;
  /** Si "Arma tu combo" se ve con la plantilla propia del negocio (se pide aparte). */
  hasBuilderTemplate: boolean;
  /** Los grupos de opciones activos del negocio, en orden, cada uno con sus opciones activas. */
  optionGroups: PublicMenuOptionGroup[];
  /**
   * "Lo más pedido": los más vendidos de la sede, el primero el más vendido.
   * TODAY cuando el día ya tiene suficientes ventas; RECENT (los de ayer)
   * mientras tanto. Null si el negocio lo apagó o no hay nada que mostrar.
   */
  topSellers: { period: 'TODAY' | 'RECENT'; productIds: string[] } | null;
}
