import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import type {
  CreateRolePayload,
  Role,
  RoleWithPermissions,
  UpdateRolePayload,
} from '../types/role.types';

export const rolesApi = {
  async getRoles(): Promise<Role[]> {
    const { data } = await apiClient.get<ApiResponse<Role[]>>('/roles');
    return data.data;
  },

  async getRole(id: string): Promise<RoleWithPermissions> {
    const { data } = await apiClient.get<ApiResponse<RoleWithPermissions>>(`/roles/${id}`);
    return data.data;
  },

  async createRole(payload: CreateRolePayload): Promise<RoleWithPermissions> {
    const { data } = await apiClient.post<ApiResponse<RoleWithPermissions>>('/roles', payload);
    return data.data;
  },

  async updateRole(id: string, payload: UpdateRolePayload): Promise<Role> {
    const { data } = await apiClient.patch<ApiResponse<Role>>(`/roles/${id}`, payload);
    return data.data;
  },

  async setRolePermissions(id: string, permissionCodes: string[]): Promise<string[]> {
    const { data } = await apiClient.put<ApiResponse<string[]>>(`/roles/${id}/permissions`, {
      permissionCodes,
    });
    return data.data;
  },
};
