export interface FeatureDefinition {
  key: string;
  label: string;
  /**
   * A paid add-on: off for every business until a platform admin turns it on
   * for that one. Everything else in the catalog is the other way round, on
   * until someone turns it off.
   */
  optIn?: boolean;
}

export interface FeatureModuleDefinition extends FeatureDefinition {
  /**
   * Optional, independently-toggleable functionality within this module.
   * Sub-feature keys are always `${moduleKey}.${camelCaseName}` (same dotted
   * convention as the permissions catalog, e.g. "inventory.read") and are
   * cascaded: a sub-feature is only effectively enabled when both it AND its
   * parent module are enabled (see BusinessFeaturesService). Disabling the
   * parent module implicitly disables every sub-feature under it, even if
   * the sub-feature's own row says enabled=true.
   *
   * TO ADD A NEW SUB-FEATURE FLAG:
   *   1. Add a `{ key: 'module.newThing', label: '...' }` entry here, under
   *      the right module's `subFeatures` array.
   *   2. Gate the backend endpoint(s): add `@RequiresFeature('module.newThing')`
   *      on the specific controller method (NOT the class, unless the whole
   *      controller IS the sub-feature) — this overrides the class-level
   *      `@RequiresFeature('module')` for that one handler; cascade already
   *      guarantees the parent module is implicitly required too.
   *   3. Gate the frontend UI element: wrap it in
   *      `<HasFeature feature="module.newThing">...</HasFeature>` (or call
   *      `usePermissions().hasFeature('module.newThing')` directly).
   *   That's it — no DB migration, no catalog-validation changes needed.
   */
  subFeatures?: FeatureDefinition[];
}

/**
 * Catalog of toggleable business modules (see business_features table and
 * the platform-admin module) — including "roles" (roles.manage +
 * users.manage), which is itself a sellable module like any other, not a
 * given. Only dashboard/settings are core and always on for every business.
 */
export const FEATURE_MODULES: FeatureModuleDefinition[] = [
  { key: 'roles', label: 'Roles y permisos' },
  { key: 'orders', label: 'Pedidos' },
  { key: 'kitchen', label: 'Cocina' },
  {
    key: 'cash-register',
    label: 'Caja',
    subFeatures: [
      { key: 'cash-register.rectification', label: 'Rectificación de caja' },
    ],
  },
  { key: 'products', label: 'Productos y recetas' },
  {
    key: 'inventory',
    label: 'Inventario',
    subFeatures: [
      {
        key: 'inventory.specializedQueries',
        label: 'Consultas especializadas',
      },
    ],
  },
  { key: 'purchases', label: 'Compras' },
  { key: 'suppliers', label: 'Proveedores' },
  { key: 'customers', label: 'Clientes' },
  { key: 'loyalty', label: 'Fidelización' },
  {
    key: 'finances',
    label: 'Finanzas',
    subFeatures: [
      { key: 'finances.reimbursements', label: 'Obligaciones de reembolso' },
      { key: 'finances.funds', label: 'Fondos (Reserva, Banco)' },
    ],
  },
  { key: 'employees', label: 'Personal' },
  { key: 'hr', label: 'Recursos Humanos' },
  { key: 'checklists', label: 'Checklists' },
  { key: 'waste', label: 'Mermas' },
  { key: 'maintenance', label: 'Equipos' },
  { key: 'documents', label: 'Documentos' },
  { key: 'documentScans', label: 'Facturas y Recibos' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'analytics', label: 'Analítica' },
  // The assistant, a separate app that reads this business's data (see the
  // tura-links module). Sold separately, so it starts off.
  { key: 'tura', label: 'TURA (asistente)', optIn: true },
  // DIAN electronic invoicing through Factus, with the business's own
  // account (see the e-invoicing module). Sold separately, so it starts off.
  { key: 'einvoicing', label: 'Facturación electrónica (DIAN)', optIn: true },
];

/** The keys that are off for a business unless it has a row turning them on. */
export const OPT_IN_FEATURE_KEYS: string[] = FEATURE_MODULES.filter(
  (module) => module.optIn,
).map((module) => module.key);

export const FEATURE_MODULE_KEYS = FEATURE_MODULES.map((f) => f.key);

/** Every valid catalog key — modules and their sub-features, flattened. Used for setFeature() validation and enabledFeatures computation. */
export const ALL_FEATURE_KEYS: string[] = FEATURE_MODULES.flatMap((m) => [
  m.key,
  ...(m.subFeatures ?? []).map((s) => s.key),
]);

/** Given any catalog key, returns its parent module key, or null if the key IS a module (top-level, no dot). */
export function getParentModuleKey(featureKey: string): string | null {
  const dotIndex = featureKey.indexOf('.');
  return dotIndex === -1 ? null : featureKey.slice(0, dotIndex);
}

/**
 * A key is effectively enabled: not itself in the disabled set, AND (it's a
 * top-level module, or its parent module isn't in the disabled set either).
 * Shared cascade predicate — used by both BusinessFeaturesService (per-tenant
 * toggles) and PlatformFeatureFlagsService (platform-wide kill switches), so
 * disabling a module always implicitly disables its sub-features in both.
 */
export function isKeyEnabled(
  featureKey: string,
  disabledKeys: Set<string>,
): boolean {
  if (disabledKeys.has(featureKey)) return false;
  const parentKey = getParentModuleKey(featureKey);
  return !parentKey || !disabledKeys.has(parentKey);
}
