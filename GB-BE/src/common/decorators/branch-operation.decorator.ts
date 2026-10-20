import { SetMetadata } from '@nestjs/common';

export const BRANCH_OPERATION_KEY = 'branchOperation';

/**
 * Marks the day-to-day work of a branch (orders, kitchen, cash, deliveries,
 * stock moves...): what is recorded here happens at one branch, so a session
 * working across all of them ("Todas las sedes", review only) can read it but
 * not record it (see BranchScopeGuard). On a controller it covers every
 * route; a route that is configuration, not operation, opts out with
 * @BranchOperation(false).
 */
export const BranchOperation = (operational = true) =>
  SetMetadata(BRANCH_OPERATION_KEY, operational);
