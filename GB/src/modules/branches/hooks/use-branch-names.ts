import { useMemo } from 'react';
import { useBranches } from './use-branches';

/** Each branch's name by id, to say whose a product or item is in "Todas las sedes". */
export function useBranchNames(): Map<string, string> {
  const { data } = useBranches({ limit: 100 });
  return useMemo(
    () => new Map((data?.data ?? []).map((branch) => [branch.id, branch.name])),
    [data],
  );
}
