import { useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../api/settings.api';

export function useUpdateDiscountsAtCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (enabled: boolean) => settingsApi.update({ discountsAtCheckout: enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses', 'me'] });
    },
  });
}
