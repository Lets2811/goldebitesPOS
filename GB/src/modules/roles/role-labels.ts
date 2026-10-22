/** Etiquetas en español solo para los roles de sistema sembrados por negocio; un rol personalizado se muestra tal cual (`role.name` real). */
export const SYSTEM_ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super administrador',
  OWNER: 'Propietario',
  MANAGER: 'Gerente',
  CASHIER: 'Cajero',
  KITCHEN: 'Cocina',
  INVENTORY: 'Inventario',
  EMPLOYEE: 'Empleado',
  COURIER: 'Domiciliario',
};

export function getRoleLabel(name: string): string {
  return SYSTEM_ROLE_LABELS[name] ?? name;
}
