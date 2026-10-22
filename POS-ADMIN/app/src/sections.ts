/** The Admin app's sections, in the order of its top bar. */
export const ADMIN_SECTIONS = [
  { path: '/', label: 'Panel' },
  { path: '/empresas', label: 'Empresas' },
  { path: '/feature-flags', label: 'Feature flags' },
  { path: '/tura', label: 'TURA' },
  { path: '/facturacion', label: 'Facturación' },
  { path: '/costos-ia', label: 'Costos IA' },
] as const;
