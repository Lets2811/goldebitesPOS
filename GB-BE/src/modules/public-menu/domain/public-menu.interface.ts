export interface PublicMenuProduct {
  id: string;
  name: string;
  salePrice: number;
  description: string | null;
  imageUrl: string | null;
  /** Which of the menu's `optionGroups` the product offers, and how many of each can be picked. */
  optionGroups: { groupId: string; maxChoices: number }[];
}

export interface PublicMenuCategory {
  /** Null for the synthetic "Otros" bucket holding products without a category. */
  id: string | null;
  name: string;
  products: PublicMenuProduct[];
}

export interface PublicMenuOption {
  id: string;
  name: string;
}

/** A group of options the customer can pick from ("Salsas", "Tamaño"...), with its active options. */
export interface PublicMenuOptionGroup {
  id: string;
  name: string;
  singularName: string;
  /** At least one must be picked wherever a product offers the group. */
  isRequired: boolean;
  items: PublicMenuOption[];
}

export interface PublicMenu {
  businessName: string;
  /** The regular menu: products offered there (MENU or BOTH). */
  categories: PublicMenuCategory[];
  /**
   * "Arma tu combo": products offered for building a combo (BUILDER or BOTH),
   * grouped by category. Empty when the business offers none — the option
   * simply doesn't show.
   */
  builderCategories: PublicMenuCategory[];
  /** What the business calls "Arma tu combo", and the line under it (defaults applied). */
  builderName: string;
  builderDescription: string;
  /** Whether "Arma tu combo" shows with the business's own template (fetched apart). */
  hasBuilderTemplate: boolean;
  /** The business's active option groups, in display order, each with its active options. */
  optionGroups: PublicMenuOptionGroup[];
}
