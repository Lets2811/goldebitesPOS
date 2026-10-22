import { Injectable } from '@nestjs/common';
import {
  BusinessRuleException,
  UnauthorizedOperationException,
} from '../../../common/exceptions';
import { BRANCH_SWITCH_PERMISSION } from '../../../common/guards/branch-scope.guard';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { BranchesService } from '../../branches/services/branches.service';

/** Which branches an assistant answer covers, as it is told back. */
export interface AssistantBranchScope {
  /** The branch the answer is limited to; null when it covers every branch. */
  branch: string | null;
  /** The business's active branches, listed only when the caller may choose between them. */
  branches?: string[];
}

export interface ResolvedBranchScope {
  /** The branch to read; undefined for every branch. */
  branchId: string | undefined;
  scope: AssistantBranchScope;
  /** Whether the business has a single active branch (nothing to tell apart). */
  single: boolean;
  /** Every branch's name by id, inactive ones included, to label what is read. */
  namesById: Map<string, string>;
  /** The business's active branches. */
  active: { id: string; name: string }[];
}

/**
 * The branch an assistant question is about. Each branch is run on its own,
 * so the answer is always one branch's or, for whoever may see them all,
 * every branch's side by side:
 *
 * - A user assigned to a branch, without branches.switch, is answered about
 *   their branch only; naming another is refused.
 * - Whoever may see every branch (branches.switch, or no branch at a business
 *   with several) names one, or gets all of them.
 * - A business with a single branch has nothing to choose between: a name is
 *   ignored there.
 *
 * A name has to point at exactly one active branch: an unknown or ambiguous
 * one is refused with the names to pick from, rather than answered with
 * some other branch's figures.
 */
@Injectable()
export class AssistantBranchScopeService {
  constructor(private readonly branchesService: BranchesService) {}

  async resolve(
    businessId: string,
    user: Pick<AuthenticatedUser, 'branchId' | 'permissions'>,
    branchName: string | undefined,
  ): Promise<ResolvedBranchScope> {
    const { data: all } = await this.branchesService.findAll({
      businessId,
      page: 1,
      limit: 100,
    });
    const namesById = new Map(all.map((branch) => [branch.id, branch.name]));
    const active = all
      .filter((branch) => branch.isActive)
      .map((branch) => ({ id: branch.id, name: branch.name }));

    if (active.length <= 1) {
      return {
        branchId: active[0]?.id ?? user.branchId ?? undefined,
        scope: { branch: null },
        single: true,
        namesById,
        active,
      };
    }

    const names = active.map((branch) => branch.name);
    const wanted = branchName?.trim() ? normalize(branchName) : null;
    const restricted =
      Boolean(user.branchId) &&
      !user.permissions.includes(BRANCH_SWITCH_PERMISSION);

    if (restricted) {
      const own = user.branchId as string;
      const ownName = namesById.get(own) ?? null;
      if (wanted && (!ownName || !normalize(ownName).includes(wanted))) {
        throw new UnauthorizedOperationException(
          `This user only has access to their own branch${ownName ? ` (${ownName})` : ''}`,
        );
      }
      return {
        branchId: own,
        scope: { branch: ownName },
        single: false,
        namesById,
        active,
      };
    }

    if (!wanted) {
      return {
        branchId: undefined,
        scope: { branch: null, branches: names },
        single: false,
        namesById,
        active,
      };
    }

    const exact = active.filter((branch) => normalize(branch.name) === wanted);
    const matches =
      exact.length > 0
        ? exact
        : active.filter((branch) => normalize(branch.name).includes(wanted));
    if (matches.length !== 1) {
      throw new BusinessRuleException(
        matches.length === 0
          ? `No active branch is called "${branchName}". Branches: ${names.join(', ')}`
          : `"${branchName}" matches several branches: ${matches.map((branch) => branch.name).join(', ')}`,
        matches.length === 0 ? 'BRANCH_NOT_FOUND' : 'BRANCH_AMBIGUOUS',
        { branches: names },
      );
    }
    return {
      branchId: matches[0].id,
      scope: { branch: matches[0].name, branches: names },
      single: false,
      namesById,
      active,
    };
  }
}

/** Branch names are matched without case or accents: "sede norte" finds "Sede Norte". */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}
