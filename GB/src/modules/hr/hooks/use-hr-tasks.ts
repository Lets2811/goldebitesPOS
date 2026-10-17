import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hrApi } from '../api/hr.api';
import { hrKeys } from '../api/hr.keys';
import type { HrTaskInput, HrTaskStatus } from '../types/hr.types';

export function useHrTasks() {
  return useQuery({ queryKey: hrKeys.tasks(), queryFn: () => hrApi.getTasks(), staleTime: 15_000 });
}

export function useMyTasks() {
  return useQuery({ queryKey: hrKeys.myTasks(), queryFn: () => hrApi.getMyTasks(), staleTime: 15_000 });
}

/** Every task mutation refreshes the board and each person's own list (they share the "tasks" key). */
function useTaskMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hrKeys.tasks() }),
  });
}

export function useCreateHrTask() {
  return useTaskMutation((payload: HrTaskInput) => hrApi.createTask(payload));
}

export function useUpdateHrTask() {
  return useTaskMutation(({ id, payload }: { id: string; payload: Partial<HrTaskInput> }) =>
    hrApi.updateTask(id, payload),
  );
}

export function useDeleteHrTask() {
  return useTaskMutation((id: string) => hrApi.deleteTask(id));
}

export function useSetMyTaskStatus() {
  return useTaskMutation(({ id, status }: { id: string; status: HrTaskStatus }) =>
    hrApi.setMyTaskStatus(id, status),
  );
}
