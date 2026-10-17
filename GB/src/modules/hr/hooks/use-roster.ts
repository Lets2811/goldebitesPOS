import { useQuery } from '@tanstack/react-query';
import { hrApi } from '../api/hr.api';
import { hrKeys } from '../api/hr.keys';

/** Who should be working each day from `from` to `to` (YYYY-MM-DD, both included). */
export function useRoster(from: string, to: string, branchId?: string) {
  return useQuery({
    queryKey: hrKeys.roster(from, to, branchId),
    queryFn: () => hrApi.getRoster({ from, to, branchId }),
    staleTime: 30_000,
  });
}
