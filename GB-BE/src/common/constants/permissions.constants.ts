import { SystemRoleName } from './roles.constants';

export interface PermissionDefinition {
  code: string;
  module: string;
  description: string;
}

/** Full permission catalog. Seeded once and referenced by code in @Permissions(). */
export const PERMISSIONS: PermissionDefinition[] = [
  {
    code: 'dashboard.read',
    module: 'dashboard',
    description: 'Ver el resumen del panel principal',
  },

  { code: 'orders.read', module: 'orders', description: 'Ver pedidos' },
  { code: 'orders.create', module: 'orders', description: 'Crear pedidos' },
  {
    code: 'orders.update',
    module: 'orders',
    description: 'Actualizar pedidos',
  },
  { code: 'orders.cancel', module: 'orders', description: 'Cancelar pedidos' },

  {
    code: 'einvoices.issue',
    module: 'einvoicing',
    description: 'Emitir facturas electrónicas (DIAN)',
  },

  {
    code: 'deliveries.read',
    module: 'deliveries',
    description: 'Ver domicilios',
  },
  {
    code: 'deliveries.manage',
    module: 'deliveries',
    description: 'Crear domicilios, asignar domiciliario y cambiar su estado',
  },
  {
    code: 'deliveries.deliver',
    module: 'deliveries',
    description:
      'Llevar domicilios: ver los propios, compartir la ubicación y chatear con el cliente',
  },
  {
    code: 'deliveries.configure',
    module: 'deliveries',
    description:
      'Configurar la tarifa de domicilios y la ubicación de las sedes',
  },

  {
    code: 'discounts.manage',
    module: 'discounts',
    description: 'Crear y administrar promociones y cupones de descuento',
  },
  {
    code: 'discounts.apply',
    module: 'discounts',
    description:
      'Aplicar descuentos al cobrar (promoción, cupón o porcentaje manual)',
  },

  {
    code: 'kitchen.read',
    module: 'kitchen',
    description: 'Ver la pantalla de cocina',
  },
  {
    code: 'kitchen.update_status',
    module: 'kitchen',
    description: 'Actualizar el estado de preparación de los pedidos',
  },

  {
    code: 'inventory.read',
    module: 'inventory',
    description: 'Ver inventario y existencias',
  },
  {
    code: 'inventory.adjust',
    module: 'inventory',
    description: 'Ajustar existencias de inventario',
  },
  {
    code: 'inventory.transfer',
    module: 'inventory',
    description: 'Transferir inventario entre ubicaciones',
  },
  {
    code: 'inventory.manage',
    module: 'inventory',
    description:
      'Crear, actualizar y desactivar ítems de inventario (catálogo de insumos)',
  },
  {
    code: 'inventory.count',
    module: 'inventory',
    description: 'Iniciar, registrar y completar conteos físicos de inventario',
  },

  { code: 'products.read', module: 'products', description: 'Ver productos' },
  {
    code: 'products.create',
    module: 'products',
    description: 'Crear productos',
  },
  {
    code: 'products.update',
    module: 'products',
    description: 'Actualizar productos',
  },

  {
    code: 'cash.open',
    module: 'cash',
    description: 'Abrir una sesión de caja',
  },
  {
    code: 'cash.close',
    module: 'cash',
    description: 'Cerrar una sesión de caja',
  },
  {
    code: 'cash.withdraw',
    module: 'cash',
    description: 'Retirar efectivo de una sesión de caja',
  },
  {
    code: 'cash.reopen',
    module: 'cash',
    description:
      'Rectificar una sesión de caja cerrada (requiere clave maestra)',
  },

  {
    code: 'purchases.read',
    module: 'purchases',
    description: 'Ver órdenes de compra',
  },
  {
    code: 'purchases.create',
    module: 'purchases',
    description: 'Crear órdenes de compra',
  },
  {
    code: 'purchases.approve',
    module: 'purchases',
    description: 'Aprobar órdenes de compra',
  },
  {
    code: 'purchases.receive',
    module: 'purchases',
    description:
      'Registrar recepciones de mercancía contra una orden de compra',
  },
  {
    code: 'purchases.cancel',
    module: 'purchases',
    description: 'Cancelar una orden de compra',
  },
  {
    code: 'suppliers.read',
    module: 'purchases',
    description: 'Ver proveedores',
  },
  {
    code: 'suppliers.manage',
    module: 'purchases',
    description: 'Crear, actualizar y desactivar proveedores',
  },

  {
    code: 'users.manage',
    module: 'users',
    description: 'Administrar usuarios',
  },
  {
    code: 'roles.manage',
    module: 'users',
    description: 'Administrar roles y sus permisos',
  },

  {
    code: 'businesses.manage',
    module: 'settings',
    description: 'Administrar la configuración del negocio',
  },
  {
    code: 'branches.manage',
    module: 'settings',
    description: 'Administrar sedes',
  },
  {
    code: 'branches.switch',
    module: 'settings',
    description:
      'Administrar todas las sedes: cambiar de sede y ver la comparativa entre sedes',
  },
  {
    code: 'settings.manage',
    module: 'settings',
    description: 'Administrar la configuración general',
  },

  {
    code: 'analytics.read',
    module: 'analytics',
    description: 'Ver analítica y reportes',
  },

  {
    code: 'employees.read',
    module: 'employees',
    description: 'Ver personal',
  },
  {
    code: 'employees.manage',
    module: 'employees',
    description: 'Crear, actualizar y administrar al personal y sus turnos',
  },

  {
    code: 'hr.read',
    module: 'hr',
    description: 'Ver la descripción de mi rol y las normas de mi sede',
  },
  {
    code: 'hr.manage',
    module: 'hr',
    description: 'Configurar normas de RH por sede',
  },
  {
    code: 'tasks.manage',
    module: 'tasks',
    description: 'Crear, asignar y administrar las tareas del equipo',
  },
  {
    code: 'leave.approve',
    module: 'leave',
    description: 'Aprobar o rechazar solicitudes de permiso del personal',
  },

  {
    code: 'checklists.read',
    module: 'checklists',
    description: 'Ver plantillas y ejecuciones de checklists',
  },
  {
    code: 'checklists.manage',
    module: 'checklists',
    description: 'Crear y actualizar plantillas de checklists',
  },
  {
    code: 'checklists.execute',
    module: 'checklists',
    description: 'Iniciar y completar ejecuciones de checklists',
  },

  {
    code: 'maintenance.read',
    module: 'maintenance',
    description: 'Ver equipos e historial de mantenimiento',
  },
  {
    code: 'maintenance.manage',
    module: 'maintenance',
    description: 'Crear/actualizar equipos y registrar intervenciones',
  },

  {
    code: 'loyalty.read',
    module: 'loyalty',
    description: 'Ver puntos, niveles y recompensas de fidelización',
  },
  {
    code: 'loyalty.manage',
    module: 'loyalty',
    description:
      'Administrar la configuración de fidelización y el catálogo de recompensas',
  },
  {
    code: 'loyalty.redeem',
    module: 'loyalty',
    description: 'Ajustar puntos de clientes y canjear recompensas',
  },

  {
    code: 'marketing.read',
    module: 'marketing',
    description: 'Ver campañas de marketing, cupones y calendario de contenido',
  },
  {
    code: 'marketing.manage',
    module: 'marketing',
    description:
      'Crear y actualizar campañas de marketing, cupones y contenido',
  },

  {
    code: 'documents.read',
    module: 'documents',
    description: 'Ver documentos de cumplimiento',
  },
  {
    code: 'documents.manage',
    module: 'documents',
    description: 'Crear y actualizar documentos de cumplimiento',
  },

  {
    code: 'document_scans.read',
    module: 'document_scans',
    description: 'Ver escaneos de facturas y recibos',
  },
  {
    code: 'document_scans.manage',
    module: 'document_scans',
    description: 'Subir y eliminar escaneos de facturas y recibos',
  },

  {
    code: 'finances.read',
    module: 'finances',
    description: 'Ver gastos y reportes financieros',
  },
  {
    code: 'finances.manage',
    module: 'finances',
    description: 'Registrar y actualizar gastos',
  },
];

/** Default permission grants per seeded system role. */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRoleName, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.code),
  OWNER: PERMISSIONS.map((p) => p.code),
  MANAGER: [
    'dashboard.read',
    'orders.read',
    'orders.create',
    'orders.update',
    'orders.cancel',
    'einvoices.issue',
    'deliveries.read',
    'deliveries.manage',
    'deliveries.configure',
    'discounts.manage',
    'discounts.apply',
    'kitchen.read',
    'kitchen.update_status',
    'inventory.read',
    'inventory.adjust',
    'inventory.transfer',
    'inventory.manage',
    'inventory.count',
    'products.read',
    'products.create',
    'products.update',
    'suppliers.read',
    'suppliers.manage',
    'cash.open',
    'cash.close',
    'cash.withdraw',
    'purchases.read',
    'purchases.create',
    'purchases.approve',
    'purchases.receive',
    'purchases.cancel',
    'users.manage',
    'branches.manage',
    'analytics.read',
    'employees.read',
    'employees.manage',
    'hr.read',
    'hr.manage',
    'tasks.manage',
    'leave.approve',
    'checklists.read',
    'checklists.manage',
    'checklists.execute',
    'maintenance.read',
    'maintenance.manage',
    'loyalty.read',
    'loyalty.manage',
    'loyalty.redeem',
    'marketing.read',
    'marketing.manage',
    'documents.read',
    'documents.manage',
    'document_scans.read',
    'document_scans.manage',
    'finances.read',
    'finances.manage',
  ],
  CASHIER: [
    'dashboard.read',
    'orders.read',
    'orders.create',
    'orders.update',
    'einvoices.issue',
    'deliveries.read',
    'deliveries.manage',
    'discounts.apply',
    'kitchen.read',
    'products.read',
    'cash.open',
    'cash.close',
    'cash.withdraw',
    'hr.read',
    'checklists.read',
    'checklists.execute',
    'loyalty.read',
    'loyalty.redeem',
  ],
  KITCHEN: [
    'orders.read',
    'kitchen.read',
    'kitchen.update_status',
    'hr.read',
    'checklists.read',
    'checklists.execute',
  ],
  INVENTORY: [
    'inventory.read',
    'inventory.adjust',
    'inventory.transfer',
    'inventory.manage',
    'inventory.count',
    'products.read',
    'suppliers.read',
    'suppliers.manage',
    'purchases.read',
    'purchases.create',
    'purchases.receive',
    'maintenance.read',
    'maintenance.manage',
    'hr.read',
    'checklists.read',
    'checklists.execute',
  ],
  EMPLOYEE: [
    'dashboard.read',
    'orders.read',
    'products.read',
    'hr.read',
    'checklists.read',
    'checklists.execute',
  ],
  // Only their own deliveries, in the courier app (/domiciliario).
  COURIER: ['deliveries.deliver'],
};
