import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { turaLinksApi, turaLinksKeys } from '../api/tura-links.api';

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
