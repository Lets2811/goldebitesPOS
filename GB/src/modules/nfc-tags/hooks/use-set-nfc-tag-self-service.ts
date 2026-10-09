import { useMutation, useQueryClient } from '@tanstack/react-query';
import { nfcTagsApi } from '../api/nfc-tags.api';
import { nfcTagsKeys } from '../api/nfc-tags.keys';

export function useSetNfcTagSelfService(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (enabled: boolean) => nfcTagsApi.setSelfService(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: nfcTagsKeys.all });
    },
  });
}
