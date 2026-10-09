/**
 * Spanish labels for permission `module` values from GB-BE's PERMISSIONS
 * catalog (see GB-BE/src/common/constants/permissions.constants.ts). These
 * keys are independent from the frontend's ModuleKey/MODULE_LABELS
 * (routes/navConfig.ts) — the two use different naming (e.g. `cash` vs
 * `cash-register`, `document_scans` vs `documentScans`), so they can't be
 * merged into a single map.
 */
export const PERMISSION_MODULE_LABELS: Record<string, string> = {
  dashboard: 'Panel principal',
  orders: 'Pedidos',
  kitchen: 'Cocina',
  inventory: 'Inventario',
  products: 'Productos y recetas',
  cash: 'Caja',
  purchases: 'Compras y proveedores',
  users: 'Usuarios y roles',
  settings: 'Configuración',
  analytics: 'Analítica',
  employees: 'Personal',
  checklists: 'Checklists',
  maintenance: 'Equipos',
  loyalty: 'Fidelización',
  marketing: 'Marketing',
  documents: 'Documentos',
  document_scans: 'Facturas y Recibos',
  finances: 'Finanzas',
};

export function getPermissionModuleLabel(module: string): string {
  return (
    PERMISSION_MODULE_LABELS[module] ??
    module.charAt(0).toUpperCase() + module.slice(1).replace(/_/g, ' ')
  );
}
