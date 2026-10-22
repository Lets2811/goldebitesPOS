import { useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../api/settings.api';

/** Enciende o apaga "Lo más pedido hoy" en el menú del cliente. */
export function useUpdateMenuTopSellers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (enabled: boolean) => settingsApi.update({ menuTopSellers: enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['public-menu'] });
    },
  });
}
