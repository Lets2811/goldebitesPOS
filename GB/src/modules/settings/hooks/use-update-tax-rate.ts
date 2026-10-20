import { useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../api/settings.api';

export function useUpdateTaxRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taxRate: number) => settingsApi.update({ taxRate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses', 'me'] });
    },
  });
}
