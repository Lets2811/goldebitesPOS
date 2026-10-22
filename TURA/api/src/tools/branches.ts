import { z } from 'zod';

/** The `sede` a read tool takes: a branch the user named, or none for every branch they may see. */
export const sedeParam = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .optional()
  .describe(
    'Nombre de una sede, solo si el usuario la nombró. Sin este campo el resultado cubre todas las sedes ' +
      'que el usuario puede ver (a quien trabaja en una sola, solo la suya).',
  );

/** Which branches a POS answer covers (see AssistantBranchScope in GB-BE). */
export interface PosBranchScope {
  branch: string | null;
  branches?: string[];
}

/** Said only when the business has several branches to choose from. */
export function describeScope(scope: PosBranchScope | undefined) {
  if (!scope?.branches) return {};
  return {
    alcance: scope.branch ? `sede ${scope.branch}` : 'todas las sedes',
    sedes_disponibles: scope.branches,
  };
}
