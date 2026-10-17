import { useState } from 'react';
import { generateId } from '../../../utils/generate-id';
import type { PublicMenuOptionGroup, PublicMenuProduct } from '../../../modules/public-menu/types/public-menu.types';
import { noneLabel } from '../../../modules/option-groups/utils/option-group-utils';

/**
 * What the customer chose for one unit: the real options picked (from any of
 * the product's groups) plus, per group, an explicit "Sin ..." (e.g. "Sin
 * salsas") — a visual, cart-only flag, never an id sent to the backend.
 */
export interface CartSelection {
  optionItemIds: string[];
  noneGroupIds: string[];
}

/**
 * A single configured unit. Every customizable unit (the product offers some
 * option group) is its own line — two units of the same product can carry
 * different choices, so they're never merged into a shared quantity.
 * Non-customizable products consolidate into one line instead. The choice is
 * made in ProductDetailDialog before the line exists and never re-edited in
 * the cart, only its quantity.
 */
export interface PublicCartLine extends CartSelection {
  id: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  /** Si la línea es parte de un "Arma tu combo": cuál (1, 2…). Nunca se fusiona con otras líneas. */
  comboNumber?: number;
}

/** Lo elegido, en el orden de los grupos: ["BBQ, Ajo", "Sin hielo"]. */
export function describeSelection(selection: CartSelection, groups: PublicMenuOptionGroup[]): string[] {
  const parts: string[] = [];
  for (const group of groups) {
    const names = group.items.filter((item) => selection.optionItemIds.includes(item.id)).map((item) => item.name);
    if (names.length > 0) parts.push(names.join(', '));
    else if (selection.noneGroupIds.includes(group.id)) parts.push(noneLabel(group.name));
  }
  return parts;
}

export function usePublicCart() {
  const [cart, setCart] = useState<PublicCartLine[]>([]);
  // One key per submission attempt: stable across retries of the same cart, rotated in clear()
  // so the next (genuinely new) submission after a success never reuses a spent key.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  function addToCart(product: PublicMenuProduct, selection: CartSelection) {
    setCart((prev) => {
      if (product.optionGroups.length === 0) {
        const existing = prev.find((line) => line.productId === product.id && !line.comboNumber);
        if (existing) {
          return prev.map((line) =>
            line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line,
          );
        }
      }
      return [
        ...prev,
        {
          id: generateId(),
          productId: product.id,
          name: product.name,
          unitPrice: product.salePrice,
          quantity: 1,
          ...selection,
        },
      ];
    });
  }

  /** Un combo armado: cada producto elegido es su propia línea, todas marcadas con el número del combo. */
  function addComboToCart(units: { product: PublicMenuProduct; selection: CartSelection }[]) {
    setCart((prev) => {
      const comboNumber = Math.max(0, ...prev.map((line) => line.comboNumber ?? 0)) + 1;
      return [
        ...prev,
        ...units.map(({ product, selection }) => ({
          id: generateId(),
          productId: product.id,
          name: product.name,
          unitPrice: product.salePrice,
          quantity: 1,
          ...selection,
          comboNumber,
        })),
      ];
    });
  }

  function increment(id: string) {
    setCart((prev) => prev.map((line) => (line.id === id ? { ...line, quantity: line.quantity + 1 } : line)));
  }

  function decrement(id: string) {
    setCart((prev) =>
      prev
        .map((line) => (line.id === id ? { ...line, quantity: line.quantity - 1 } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  function remove(id: string) {
    setCart((prev) => prev.filter((line) => line.id !== id));
  }

  function clear() {
    setCart([]);
    setIdempotencyKey(crypto.randomUUID());
  }

  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  return { cart, addToCart, addComboToCart, increment, decrement, remove, clear, itemCount, total, idempotencyKey };
}
