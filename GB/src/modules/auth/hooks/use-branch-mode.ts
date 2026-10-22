import { useAuthStore } from '../store/auth.store';
import { usePermissions } from './use-permissions';

/**
 * Whether the session is in "Todas las sedes": someone who may work at every
 * branch, working across all of them. It is for review: what a branch records
 * day to day (orders, kitchen, cash, stock moves...) is done at a branch, and
 * the API refuses it here.
 */
export function useAllBranchesReview(): boolean {
  const branchId = useAuthStore((s) => s.user?.branchId ?? null);
  const { hasPermission } = usePermissions();
  return hasPermission('branches.switch') && branchId === null;
}
