import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tableHelpRequestKeys, tableHelpRequestsApi } from '../api/table-help-requests.api';

/**
 * Las mesas que están pidiendo ayuda. Se consulta seguido y también con la
 * pestaña en segundo plano: la alerta tiene que sonar aunque Pedidos no esté
 * a la vista.
 */
export function usePendingTableHelpRequests(branchId?: string | null) {
  return useQuery({
    queryKey: tableHelpRequestKeys.pending(branchId),
    queryFn: () => tableHelpRequestsApi.getPending(branchId),
    staleTime: 0,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });
}

export function useAttendTableHelpRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tableHelpRequestsApi.attend(id),
    // También si falla: lo más probable es que un compañero ya la haya atendido.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tableHelpRequestKeys.all });
    },
  });
}

export function useRequestTableHelp(token: string | undefined) {
  return useMutation({
    mutationFn: () => tableHelpRequestsApi.requestFromTable(token as string),
  });
}
