import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hrApi } from '../api/hr.api';
import { hrKeys } from '../api/hr.keys';
import type { LeaveRequestInput, LeaveRequestStatus } from '../types/hr.types';

export function useLeaveRequests(status?: LeaveRequestStatus) {
  return useQuery({
    queryKey: hrKeys.leaveRequests(status),
    queryFn: () => hrApi.getLeaveRequests(status),
    staleTime: 15_000,
  });
}

export function useMyLeaveRequests() {
  return useQuery({
    queryKey: hrKeys.myLeaveRequests(),
    queryFn: () => hrApi.getMyLeaveRequests(),
    staleTime: 15_000,
  });
}

/** A request changing also changes who's working those days, so the roster refreshes too. */
function useLeaveMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...hrKeys.all, 'leave-requests'] });
      queryClient.invalidateQueries({ queryKey: [...hrKeys.all, 'roster'] });
    },
  });
}

export function useReviewLeaveRequest() {
  return useLeaveMutation(
    ({ id, decision, note }: { id: string; decision: 'APPROVED' | 'REJECTED'; note?: string }) =>
      hrApi.reviewLeaveRequest(id, decision, note),
  );
}

export function useCreateEmployeeLeave() {
  return useLeaveMutation((payload: LeaveRequestInput & { employeeId: string }) =>
    hrApi.createEmployeeLeave(payload),
  );
}

export function useRequestMyLeave() {
  return useLeaveMutation((payload: LeaveRequestInput) => hrApi.requestMyLeave(payload));
}

export function useCancelMyLeaveRequest() {
  return useLeaveMutation((id: string) => hrApi.cancelMyLeaveRequest(id));
}
