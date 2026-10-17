import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import type {
  BranchRule,
  BranchRuleInput,
  HrProfile,
  HrTask,
  HrTaskInput,
  HrTaskStatus,
  LeaveRequest,
  LeaveRequestInput,
  LeaveRequestStatus,
  RosterDay,
} from '../types/hr.types';

export const hrApi = {
  async getBranchRules(branchId: string): Promise<BranchRule[]> {
    const { data } = await apiClient.get<ApiResponse<BranchRule[]>>('/hr/branch-rules', {
      params: { branchId },
    });
    return data.data;
  },

  async setBranchRules(branchId: string, rules: BranchRuleInput[]): Promise<BranchRule[]> {
    const { data } = await apiClient.put<ApiResponse<BranchRule[]>>(
      '/hr/branch-rules',
      { rules },
      { params: { branchId } },
    );
    return data.data;
  },

  async getMyProfile(): Promise<HrProfile> {
    const { data } = await apiClient.get<ApiResponse<HrProfile>>('/hr/my-profile');
    return data.data;
  },

  async getRoster(params: { from: string; to: string; branchId?: string }): Promise<RosterDay[]> {
    const { data } = await apiClient.get<ApiResponse<RosterDay[]>>('/hr/roster', { params });
    return data.data;
  },

  async getTasks(): Promise<HrTask[]> {
    const { data } = await apiClient.get<ApiResponse<HrTask[]>>('/hr/tasks');
    return data.data;
  },

  async createTask(payload: HrTaskInput): Promise<HrTask> {
    const { data } = await apiClient.post<ApiResponse<HrTask>>('/hr/tasks', payload);
    return data.data;
  },

  async updateTask(id: string, payload: Partial<HrTaskInput>): Promise<HrTask> {
    const { data } = await apiClient.patch<ApiResponse<HrTask>>(`/hr/tasks/${id}`, payload);
    return data.data;
  },

  async deleteTask(id: string): Promise<void> {
    await apiClient.delete(`/hr/tasks/${id}`);
  },

  async getMyTasks(): Promise<HrTask[]> {
    const { data } = await apiClient.get<ApiResponse<HrTask[]>>('/hr/tasks/mine');
    return data.data;
  },

  async setMyTaskStatus(id: string, status: HrTaskStatus): Promise<HrTask> {
    const { data } = await apiClient.patch<ApiResponse<HrTask>>(`/hr/tasks/mine/${id}/status`, { status });
    return data.data;
  },

  async getLeaveRequests(status?: LeaveRequestStatus): Promise<LeaveRequest[]> {
    const { data } = await apiClient.get<ApiResponse<LeaveRequest[]>>('/hr/leave-requests', {
      params: { status },
    });
    return data.data;
  },

  async createEmployeeLeave(payload: LeaveRequestInput & { employeeId: string }): Promise<LeaveRequest> {
    const { data } = await apiClient.post<ApiResponse<LeaveRequest>>('/hr/leave-requests', payload);
    return data.data;
  },

  async reviewLeaveRequest(
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    note?: string,
  ): Promise<LeaveRequest> {
    const { data } = await apiClient.patch<ApiResponse<LeaveRequest>>(`/hr/leave-requests/${id}/review`, {
      decision,
      note,
    });
    return data.data;
  },

  async getMyLeaveRequests(): Promise<LeaveRequest[]> {
    const { data } = await apiClient.get<ApiResponse<LeaveRequest[]>>('/hr/leave-requests/mine');
    return data.data;
  },

  async requestMyLeave(payload: LeaveRequestInput): Promise<LeaveRequest> {
    const { data } = await apiClient.post<ApiResponse<LeaveRequest>>('/hr/leave-requests/mine', payload);
    return data.data;
  },

  async cancelMyLeaveRequest(id: string): Promise<LeaveRequest> {
    const { data } = await apiClient.patch<ApiResponse<LeaveRequest>>(`/hr/leave-requests/mine/${id}/cancel`);
    return data.data;
  },
};
