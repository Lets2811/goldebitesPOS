import type { ComponentType } from 'react';

/** Módulos de navegación. La visibilidad real se decide por permisos del JWT — ver routes/navConfig.ts MODULE_PERMISSIONS. */
export type ModuleKey =
  | 'dashboard'
  | 'orders'
  | 'ordersBacklog'
  | 'kitchen'
  | 'deliveries'
  | 'cash-register'
  | 'products'
  | 'inventory'
  | 'purchases'
  | 'suppliers'
  | 'customers'
  | 'loyalty'
  | 'finances'
  | 'employees'
  | 'hr'
  | 'checklists'
  | 'waste'
  | 'maintenance'
  | 'documents'
  | 'documentScans'
  | 'marketing'
  | 'analytics'
  | 'settings'
  | 'roles';

export interface NavLeaf {
  kind: 'item';
  module: ModuleKey;
  label: string;
  path: string;
  icon: ComponentType<{ size?: number | string; strokeWidth?: number; className?: string }>;
  badge?: number;
}

export interface NavGroup {
  kind: 'group';
  label: string;
  items: NavLeaf[];
}

export type NavEntry = NavLeaf | NavGroup;
