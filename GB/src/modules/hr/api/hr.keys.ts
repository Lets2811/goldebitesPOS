export const hrKeys = {
  all: ['hr'] as const,
  branchRules: (branchId: string) => [...hrKeys.all, 'branch-rules', branchId] as const,
  myProfile: () => [...hrKeys.all, 'my-profile'] as const,
  roster: (from: string, to: string, branchId?: string) =>
    [...hrKeys.all, 'roster', from, to, branchId ?? 'all'] as const,
  tasks: () => [...hrKeys.all, 'tasks'] as const,
  myTasks: () => [...hrKeys.all, 'tasks', 'mine'] as const,
  leaveRequests: (status?: string) => [...hrKeys.all, 'leave-requests', status ?? 'all'] as const,
  myLeaveRequests: () => [...hrKeys.all, 'leave-requests', 'mine'] as const,
};
