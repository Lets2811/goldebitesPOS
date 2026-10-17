import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformTuraApi, turaLinksApi, turaLinksKeys } from '../api/tura-links.api';

export function useTuraLinks() {
  return useQuery({
    queryKey: turaLinksKeys.all,
    queryFn: () => turaLinksApi.getAll(),
  });
}

export function useGenerateTuraLinkCode() {
  return useMutation({ mutationFn: () => turaLinksApi.generateCode() });
}

export function useRevokeTuraLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => turaLinksApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: turaLinksKeys.all });
    },
  });
}

export function usePlatformTura(businessId: string) {
  return useQuery({
    queryKey: turaLinksKeys.platform(businessId),
    queryFn: () => platformTuraApi.getStatus(businessId),
  });
}

export function useGeneratePlatformTuraCode(businessId: string) {
  return useMutation({
    mutationFn: (userId: string) => platformTuraApi.generateCode(businessId, userId),
  });
}

export function useRevokePlatformTuraLink(businessId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => platformTuraApi.revoke(businessId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: turaLinksKeys.platform(businessId) });
    },
  });
}
