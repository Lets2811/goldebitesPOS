import { queryClient } from '../lib/query-client';
import type { PaginatedResponse } from '../lib/api/api-types';
import { registerSearchProvider } from './globalSearch';
import { productKeys } from '../modules/products/api/products.keys';
import type { Product } from '../modules/products/types/product.types';
import { customerKeys } from '../modules/customers/api/customers.keys';
import type { Customer } from '../modules/customers/types/customer.types';
import { orderKeys } from '../modules/orders/api/orders.keys';
import type { Order } from '../modules/orders/types/order.types';
import { MODULE_PATHS, isModuleDisabled } from '../routes/navConfig';

/**
 * Busca sobre lo que React Query ya tiene en caché (listas visitadas en esta
 * sesión), sin disparar peticiones nuevas — no hay un endpoint de búsqueda
 * global en el backend.
 */
function cachedListItems<T>(listKeyPrefix: readonly unknown[]): T[] {
  const entries = queryClient.getQueriesData<PaginatedResponse<T>>({ queryKey: listKeyPrefix });
  return entries.flatMap(([, data]) => data?.data ?? []);
}

/** Registra los proveedores de búsqueda global (barra superior). Se llama una sola vez al arrancar la app. */
export function registerCoreSearchProviders(): void {
  registerSearchProvider(() =>
    cachedListItems<Product>(productKeys.lists()).map((product) => ({
      id: `product-${product.id}`,
      title: product.name,
      subtitle: product.sku ?? 'Producto',
      group: 'Productos',
      path: '/productos',
    })),
  );

  // Pedidos sigue cargando la lista de clientes, así que estarían en caché
  // aunque su sección esté apagada: sin esto, la búsqueda llevaría a una
  // página que no existe.
  if (!isModuleDisabled('customers')) {
    registerSearchProvider(() =>
      cachedListItems<Customer>(customerKeys.lists()).map((customer) => ({
        id: `customer-${customer.id}`,
        title: `${customer.firstName} ${customer.lastName ?? ''}`.trim(),
        subtitle: customer.phone ?? customer.email ?? 'Cliente',
        group: 'Clientes',
        path: MODULE_PATHS.customers,
      })),
    );
  }

  registerSearchProvider(() =>
    cachedListItems<Order>(orderKeys.lists()).map((order) => ({
      id: `order-${order.id}`,
      title: `Pedido #${order.orderNumber}`,
      subtitle: `${order.orderType} · ${order.status}`,
      group: 'Pedidos',
      path: '/pedidos',
    })),
  );
}
