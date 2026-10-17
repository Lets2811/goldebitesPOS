import { useState } from 'react';
import type { CartLine } from '../../../features/kiosk-waiter/components/CartPanel';
import type { Product } from '../../products/types/product.types';
import { generateId } from '../../../utils/generate-id';
import { useOptionGroups } from '../../option-groups/hooks/use-option-groups';
import { offeredGroups, toggleOptionId } from '../../option-groups/utils/option-group-utils';
import type { CreateOrderItemPayload } from '../types/order.types';

/** A cart line as an order item. */
export function cartLineToOrderItem(line: CartLine): CreateOrderItemPayload {
  return {
    productId: line.productId,
    quantity: line.quantity,
    optionItemIds: line.optionItemIds.length ? line.optionItemIds : undefined,
  };
}

/** Cart-line state management shared by the waiter and car-service kiosks, "add products" drawer, and the new-order flow. */
export function useCartLines() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const { groups } = useOptionGroups();

  function addToCart(product: Product) {
    // Only the groups the business has on and with something to pick.
    const optionGroups = offeredGroups(product, groups).map(({ group, maxChoices }) => ({
      groupId: group.id,
      maxChoices,
    }));
    setCart((prev) => {
      // Products with options need one picker per unit, so each tap adds its own
      // independently-configurable line instead of bumping a shared quantity — otherwise two
      // units of the same product could never get different choices.
      if (optionGroups.length === 0) {
        const existing = prev.find((line) => line.productId === product.id);
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
          optionGroups,
          optionItemIds: [],
        },
      ];
    });
  }

  function toggleOption(id: string, groupId: string, itemId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setCart((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const maxChoices = line.optionGroups.find((o) => o.groupId === groupId)?.maxChoices ?? 0;
        return { ...line, optionItemIds: toggleOptionId(line.optionItemIds, group, itemId, maxChoices) };
      }),
    );
  }

  function increment(id: string) {
    setCart((prev) => {
      const line = prev.find((l) => l.id === id);
      if (!line) return prev;
      // Same rule as addToCart: a customizable line can't just grow its quantity, since that
      // would go back to sharing one picker across units — add another independent unit instead.
      if (line.optionGroups.length > 0) {
        return [...prev, { ...line, id: generateId(), quantity: 1, optionItemIds: [] }];
      }
      return prev.map((l) => (l.id === id ? { ...l, quantity: l.quantity + 1 } : l));
    });
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
  }

  return { cart, addToCart, toggleOption, increment, decrement, remove, clear };
}
