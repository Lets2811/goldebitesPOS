import {
  LayoutDashboard,
  ClipboardList,
  History,
  ChefHat,
  Wallet,
  Bike,
  UtensilsCrossed,
  Boxes,
  ShoppingCart,
  Truck,
  Users,
  Gift,
  Landmark,
  UserCog,
  ListChecks,
  Trash2,
  Wrench,
  FileText,
  FileScan,
  Megaphone,
  BarChart3,
  Settings,
} from 'lucide-react';
import type { ModuleKey, NavEntry } from '../types/nav';

export const MODULE_PATHS = {
  dashboard: '/',
  orders: '/pedidos',
  ordersBacklog: '/pedidos-atrasados',
  kitchen: '/cocina',
  deliveries: '/domicilios',
  'cash-register': '/caja',
  products: '/productos',
  productsCatalog: '/productos/catalogo',
  productsCategories: '/productos/categorias',
  productsMenuOrganizer: '/productos/organizar',
  productsOptionGroup: '/productos/opciones/:groupId',
  inventory: '/inventario',
  purchases: '/compras',
  suppliers: '/proveedores',
  customers: '/clientes',
  loyalty: '/fidelizacion',
  finances: '/finanzas',
  employees: '/recursos-humanos/personal',
  hr: '/recursos-humanos',
  hrRules: '/recursos-humanos/normas',
  hrRoster: '/recursos-humanos/turnos',
  hrTasks: '/recursos-humanos/tareas',
  hrLeave: '/recursos-humanos/solicitudes',
  checklists: '/checklists',
  waste: '/mermas',
  maintenance: '/mantenimiento',
  documents: '/documentos',
  documentScans: '/facturas-recibos',
  marketing: '/marketing',
  analytics: '/analitica',
  settings: '/configuracion',
  roles: '/recursos-humanos/roles-permisos',
} as const;

/** Rutas anteriores a reunir Personal y Roles y permisos dentro de Recursos Humanos; redirigen a las nuevas. */
export const LEGACY_PATH_REDIRECTS: Record<string, string> = {
  '/personal': MODULE_PATHS.employees,
  '/roles-permisos': MODULE_PATHS.roles,
};

/** La pantalla de un grupo de opciones ("Salsas", "Tamaño"...). */
export const optionGroupPath = (groupId: string) => `/productos/opciones/${groupId}`;

/**
 * Un módulo de navegación es visible si el usuario tiene AL MENOS uno de
 * estos permisos reales (del JWT, ver modules/auth/hooks/use-permissions.ts)
 * — no es un mapeo por rol hardcodeado, así que un rol personalizado con
 * permisos limitados solo ve lo que de verdad puede usar. `customers` y
 * `waste` reusan permisos de `orders`/`inventory` porque así los gatea hoy
 * el backend real (no existe `customers.*`/`waste.*` en el catálogo).
 */
export const MODULE_PERMISSIONS: Record<ModuleKey, string | string[]> = {
  dashboard: 'dashboard.read',
  orders: 'orders.read',
  ordersBacklog: 'orders.read',
  kitchen: 'kitchen.read',
  deliveries: 'deliveries.read',
  'cash-register': 'cash.open',
  products: 'products.read',
  inventory: 'inventory.read',
  purchases: 'purchases.read',
  suppliers: 'suppliers.read',
  customers: 'orders.read',
  loyalty: 'loyalty.read',
  finances: 'finances.read',
  employees: 'employees.read',
  hr: 'hr.manage',
  checklists: 'checklists.read',
  waste: 'inventory.read',
  maintenance: 'maintenance.read',
  documents: 'documents.read',
  documentScans: 'document_scans.read',
  marketing: 'marketing.read',
  analytics: 'analytics.read',
  settings: ['settings.manage', 'businesses.manage', 'branches.manage'],
  roles: 'roles.manage',
};

/**
 * Módulos apagados por ahora mientras se rediseña el POS: no aparecen en el
 * menú y sus rutas no existen (llevan a "página no encontrada"). Es solo de
 * la interfaz: sus pantallas, su API y sus datos siguen intactos, y otras
 * pantallas siguen usando esa API (Pedidos busca clientes, el Centro de
 * operaciones lee ventas de analítica). Para volver a encender uno, basta con
 * quitarlo de esta lista.
 */
const DISABLED_MODULES: ReadonlySet<ModuleKey> = new Set([
  'customers',
  'loyalty',
  'analytics',
  'marketing',
  'documents',
  'documentScans',
]);

export function isModuleDisabled(module: ModuleKey): boolean {
  return DISABLED_MODULES.has(module);
}

const ALL_NAV_ENTRIES: NavEntry[] = [
  {
    kind: 'item',
    module: 'dashboard',
    label: 'Centro de operaciones',
    path: MODULE_PATHS.dashboard,
    icon: LayoutDashboard,
  },
  {
    kind: 'group',
    label: 'Operación diaria',
    items: [
      { kind: 'item', module: 'orders', label: 'Pedidos', path: MODULE_PATHS.orders, icon: ClipboardList },
      {
        kind: 'item',
        module: 'ordersBacklog',
        label: 'Pedidos atrasados',
        path: MODULE_PATHS.ordersBacklog,
        icon: History,
      },
      { kind: 'item', module: 'kitchen', label: 'Cocina', path: MODULE_PATHS.kitchen, icon: ChefHat },
      { kind: 'item', module: 'deliveries', label: 'Domicilios', path: MODULE_PATHS.deliveries, icon: Bike },
      {
        kind: 'item',
        module: 'cash-register',
        label: 'Caja',
        path: MODULE_PATHS['cash-register'],
        icon: Wallet,
      },
    ],
  },
  {
    kind: 'group',
    label: 'Catálogo e inventario',
    items: [
      {
        kind: 'item',
        module: 'products',
        label: 'Productos y recetas',
        path: MODULE_PATHS.products,
        icon: UtensilsCrossed,
      },
      { kind: 'item', module: 'inventory', label: 'Inventario', path: MODULE_PATHS.inventory, icon: Boxes },
      {
        kind: 'item',
        module: 'purchases',
        label: 'Compras y gastos',
        path: MODULE_PATHS.purchases,
        icon: ShoppingCart,
      },
      {
        kind: 'item',
        module: 'suppliers',
        label: 'Proveedores',
        path: MODULE_PATHS.suppliers,
        icon: Truck,
      },
    ],
  },
  {
    kind: 'group',
    label: 'Clientes',
    items: [
      { kind: 'item', module: 'customers', label: 'Clientes', path: MODULE_PATHS.customers, icon: Users },
      { kind: 'item', module: 'loyalty', label: 'Fidelización', path: MODULE_PATHS.loyalty, icon: Gift },
    ],
  },
  {
    kind: 'group',
    label: 'Gestión del negocio',
    items: [
      { kind: 'item', module: 'finances', label: 'Finanzas', path: MODULE_PATHS.finances, icon: Landmark },
      {
        kind: 'item',
        module: 'hr',
        label: 'Recursos Humanos',
        path: MODULE_PATHS.hr,
        icon: UserCog,
      },
      {
        kind: 'item',
        module: 'analytics',
        label: 'Analítica',
        path: MODULE_PATHS.analytics,
        icon: BarChart3,
      },
      {
        kind: 'item',
        module: 'marketing',
        label: 'Marketing',
        path: MODULE_PATHS.marketing,
        icon: Megaphone,
      },
    ],
  },
  {
    kind: 'group',
    label: 'Control operativo',
    items: [
      {
        kind: 'item',
        module: 'checklists',
        label: 'Checklists',
        path: MODULE_PATHS.checklists,
        icon: ListChecks,
      },
      { kind: 'item', module: 'waste', label: 'Mermas', path: MODULE_PATHS.waste, icon: Trash2 },
      {
        kind: 'item',
        module: 'maintenance',
        label: 'Equipos',
        path: MODULE_PATHS.maintenance,
        icon: Wrench,
      },
      {
        kind: 'item',
        module: 'documents',
        label: 'Documentos',
        path: MODULE_PATHS.documents,
        icon: FileText,
      },
      {
        kind: 'item',
        module: 'documentScans',
        label: 'Facturas y Recibos',
        path: MODULE_PATHS.documentScans,
        icon: FileScan,
      },
    ],
  },
  {
    kind: 'item',
    module: 'settings',
    label: 'Configuración',
    path: MODULE_PATHS.settings,
    icon: Settings,
  },
];

/** El menú sin los módulos apagados; un grupo que se queda sin opciones tampoco aparece. */
export const NAV_ENTRIES: NavEntry[] = ALL_NAV_ENTRIES.flatMap((entry): NavEntry[] => {
  if (entry.kind === 'item') {
    return isModuleDisabled(entry.module) ? [] : [entry];
  }
  const items = entry.items.filter((item) => !isModuleDisabled(item.module));
  return items.length > 0 ? [{ ...entry, items }] : [];
});

export const MODULE_LABELS: Record<string, string> = ALL_NAV_ENTRIES.flatMap((entry) =>
  entry.kind === 'group' ? entry.items : [entry],
).reduce((acc, item) => ({ ...acc, [item.module]: item.label }), {} as Record<string, string>);

export interface HrSection {
  /** Módulo activable del backend que la pestaña exige (ver FEATURE_MODULES). */
  module: ModuleKey;
  label: string;
  path: string;
  permission: string;
}

/**
 * Pestañas de Recursos Humanos, en el orden en que se muestran. Cada una
 * sigue siendo su propio módulo con su propio permiso: la entrada del menú
 * aparece si el usuario puede abrir al menos una, y solo ve las que puede.
 */
export const HR_SECTIONS: HrSection[] = [
  { module: 'employees', label: 'Personal', path: MODULE_PATHS.employees, permission: 'employees.read' },
  { module: 'employees', label: 'Turnos', path: MODULE_PATHS.hrRoster, permission: 'employees.read' },
  { module: 'hr', label: 'Tareas', path: MODULE_PATHS.hrTasks, permission: 'tasks.manage' },
  { module: 'hr', label: 'Solicitudes', path: MODULE_PATHS.hrLeave, permission: 'leave.approve' },
  { module: 'roles', label: 'Roles y permisos', path: MODULE_PATHS.roles, permission: 'roles.manage' },
  { module: 'hr', label: 'Normas', path: MODULE_PATHS.hrRules, permission: 'hr.manage' },
];
