export interface Role {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface RoleWithPermissions extends Role {
  permissions: string[];
}

export interface CreateRolePayload {
  name: string;
  description?: string;
  /** Permisos con los que nace el rol; el backend los asigna en la misma transacción. */
  permissionCodes?: string[];
}

export type UpdateRolePayload = Partial<Omit<CreateRolePayload, 'permissionCodes'>>;
