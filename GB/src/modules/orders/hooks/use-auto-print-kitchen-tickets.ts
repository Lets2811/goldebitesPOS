import { useEffect, useRef } from 'react';
import { ordersApi } from '../api/orders.api';
import { printKitchenTicket } from '../utils/print-kitchen-ticket';
import { playOrderNotificationSound } from '../utils/notification-sound';
import type { Order } from '../types/order.types';

const PRINTED_IDS_STORAGE_KEY = 'gb-pos:orders-printed-order-ids';
const ITEM_STATE_STORAGE_KEY = 'gb-pos:orders-item-state';
const MAX_STORED_ENTRIES = 300;

interface OrderItemState {
  updatedAt: string;
  itemIds: string[];
}

function loadPrintedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(PRINTED_IDS_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function savePrintedIds(ids: Set<string>): void {
  localStorage.setItem(PRINTED_IDS_STORAGE_KEY, JSON.stringify(Array.from(ids).slice(-MAX_STORED_ENTRIES)));
}

function loadItemState(): Record<string, OrderItemState> {
  try {
    const raw = localStorage.getItem(ITEM_STATE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, OrderItemState>) : {};
  } catch {
    return {};
  }
}

function saveItemState(state: Record<string, OrderItemState>): void {
  const entries = Object.entries(state).slice(-MAX_STORED_ENTRIES);
  localStorage.setItem(ITEM_STATE_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
}

/**
 * Imprime automáticamente la comanda de cada pedido nuevo confirmado (no PENDING/CANCELLED), y
 * también una comanda de adición cuando se le agregan productos a un pedido ya conocido — en
 * ambos casos con un aviso sonoro. Los pedidos que ya existían al montar el hook (p.ej. tras
 * recargar la página) se marcan como "vistos" sin imprimir, para no reimprimir todo el historial
 * del día ni tratar sus ítems ya existentes como una "adición".
 */
export function useAutoPrintKitchenTickets(
  orders: Order[] | undefined,
  businessName: string | undefined,
  businessLogo: string | null | undefined,
  enabled: boolean,
  tableNames?: Record<string, string>,
) {
  const printedIds = useRef<Set<string>>(loadPrintedIds());
  const itemState = useRef<Record<string, OrderItemState>>(loadItemState());
  const isFirstLoad = useRef(true);
  const inFlightIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !orders) return;

    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      orders.forEach((order) => printedIds.current.add(order.id));
      savePrintedIds(printedIds.current);
      return;
    }

    orders.forEach((order) => {
      if (inFlightIds.current.has(order.id)) return;

      const isNewOrder = !printedIds.current.has(order.id);
      const knownItemState = itemState.current[order.id];
      const needsItemCheck = !isNewOrder && (!knownItemState || knownItemState.updatedAt !== order.updatedAt);

      if (!isNewOrder && !needsItemCheck) return;

      inFlightIds.current.add(order.id);
      ordersApi
        .getOrder(order.id)
        .then((fullOrder) => {
          if (isNewOrder) {
            printKitchenTicket(fullOrder, { businessName, businessLogo, tableNames });
            playOrderNotificationSound();
          } else if (knownItemState) {
            const newItems = fullOrder.items.filter((item) => !knownItemState.itemIds.includes(item.id));
            if (newItems.length > 0) {
              printKitchenTicket(fullOrder, { businessName, businessLogo, addedItems: newItems, tableNames });
              playOrderNotificationSound();
            }
          }
          // Missing knownItemState (order known from before this feature existed, or first
          // sighting via needsItemCheck) just establishes the baseline below — no print.

          itemState.current[order.id] = {
            updatedAt: fullOrder.updatedAt,
            itemIds: fullOrder.items.map((item) => item.id),
          };
          saveItemState(itemState.current);
          // Solo aquí queda como impreso: si la carga falla, el pedido sigue
          // pendiente y se reintenta en la siguiente consulta en vez de perder la comanda.
          printedIds.current.add(order.id);
          savePrintedIds(printedIds.current);
        })
        .catch(() => {
          // Sin marcar: la próxima consulta lo vuelve a intentar.
        })
        .finally(() => {
          inFlightIds.current.delete(order.id);
        });
    });
  }, [orders, businessName, businessLogo, enabled, tableNames]);
}
