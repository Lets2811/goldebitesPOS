import { BusinessRuleException } from '../exceptions';

/**
 * The branch a new catalog entry (product, inventory item) joins: each branch
 * has its own. In "Todas las sedes" there is none to take it from, so it has
 * to be named.
 */
export function requireBranch(branchId: string | null | undefined): string {
  if (!branchId) {
    throw new BusinessRuleException(
      'Elige la sede a la que pertenece',
      'BRANCH_REQUIRED',
    );
  }
  return branchId;
}
