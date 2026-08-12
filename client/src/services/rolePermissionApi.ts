import axios from "../utils/axiosConfig";

export interface PermissionDefinition {
  id: number;
  key: string;
  category: string;
  description: string | null;
}

export type PermissionCatalog = Record<string, PermissionDefinition[]>;

export interface RoleSummary {
  id: number;
  name: string;
  description: string | null;
  is_system: boolean;
  permissionCount: number;
  userCount: number;
}

export interface RoleDetail {
  id: number;
  name: string;
  description: string | null;
  is_system: boolean;
  permissionKeys: string[];
}

export class RolePermissionApiService {
  static async getPermissionCatalog(): Promise<{ success: boolean; data: PermissionCatalog }> {
    const response = await axios.get("/roles-permissions/permissions");
    return response.data;
  }

  static async listRoles(): Promise<{ success: boolean; data: RoleSummary[] }> {
    const response = await axios.get("/roles-permissions/roles");
    return response.data;
  }

  static async getRole(roleId: number): Promise<{ success: boolean; data: RoleDetail }> {
    const response = await axios.get(`/roles-permissions/roles/${roleId}`);
    return response.data;
  }

  static async createRole(payload: {
    name: string;
    description?: string | null;
    permissionKeys: string[];
  }): Promise<{ success: boolean; data: { id: number } }> {
    const response = await axios.post("/roles-permissions/roles", payload);
    return response.data;
  }

  static async updateRole(
    roleId: number,
    payload: { name?: string; description?: string | null; permissionKeys?: string[] },
  ): Promise<{ success: boolean }> {
    const response = await axios.put(`/roles-permissions/roles/${roleId}`, payload);
    return response.data;
  }

  static async deleteRole(roleId: number): Promise<{ success: boolean; message: string }> {
    const response = await axios.delete(`/roles-permissions/roles/${roleId}`);
    return response.data;
  }

  static async assignUserRole(
    userId: number,
    roleId: number,
  ): Promise<{ success: boolean; message: string }> {
    const response = await axios.put(`/roles-permissions/users/${userId}/role`, { roleId });
    return response.data;
  }
}
