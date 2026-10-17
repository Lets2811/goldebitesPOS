import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productKeys } from '../../products/api/products.keys';
import { optionGroupKeys, optionGroupsApi } from '../api/option-groups.api';
import type {
  CreateOptionGroupPayload,
  CreateOptionItemPayload,
  OptionGroup,
  UpdateOptionGroupPayload,
  UpdateOptionItemPayload,
} from '../types/option-group.types';

const EMPTY: OptionGroup[] = [];

/** Todos los grupos del negocio con todas sus opciones (activas o no), en orden. */
export function useOptionGroups() {
  const query = useQuery({
    queryKey: optionGroupKeys.all,
    queryFn: optionGroupsApi.getAll,
    staleTime: 60_000,
  });
  return { ...query, groups: query.data ?? EMPTY };
}

function useInvalidateGroups() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: optionGroupKeys.all });
}

export function useCreateOptionGroup() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (payload: CreateOptionGroupPayload) => optionGroupsApi.createGroup(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateOptionGroup() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateOptionGroupPayload }) =>
      optionGroupsApi.updateGroup(id, payload),
    onSuccess: invalidate,
  });
}

export function useSetOptionGroupOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupIds: string[]) => optionGroupsApi.setOrder(groupIds),
    onSuccess: (groups) => queryClient.setQueryData(optionGroupKeys.all, groups),
  });
}

export function useCreateOptionItem() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: ({ groupId, payload }: { groupId: string; payload: CreateOptionItemPayload }) =>
      optionGroupsApi.createItem(groupId, payload),
    onSuccess: invalidate,
  });
}

export function useUpdateOptionItem() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: ({ groupId, id, payload }: { groupId: string; id: string; payload: UpdateOptionItemPayload }) =>
      optionGroupsApi.updateItem(groupId, id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteOptionGroup() {
  const invalidate = useInvalidateGroups();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => optionGroupsApi.deleteGroup(id),
    onSuccess: () => {
      invalidate();
      // Products that offered it no longer do.
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

export function useDeleteOptionItem() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: ({ groupId, id }: { groupId: string; id: string }) => optionGroupsApi.deleteItem(groupId, id),
    onSuccess: invalidate,
  });
}
