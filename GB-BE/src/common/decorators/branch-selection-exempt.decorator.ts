import { SetMetadata } from '@nestjs/common';

export const BRANCH_SELECTION_EXEMPT_KEY = 'branchSelectionExempt';

/**
 * Lets a route answer a session that has not picked its branch yet (see
 * BranchScopeGuard): signing in and out, picking the branch, and what the
 * branch picker itself shows (the business and its branches).
 */
export const BranchSelectionExempt = () =>
  SetMetadata(BRANCH_SELECTION_EXEMPT_KEY, true);
