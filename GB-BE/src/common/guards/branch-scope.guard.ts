import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { Reflector } from '@nestjs/core';
import { getMetadataStorage } from 'class-validator';
import { BRANCH_SELECTION_EXEMPT_KEY } from '../decorators/branch-selection-exempt.decorator';
import { DomainException } from '../exceptions';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/** Who may work at every branch; see AuthService.switchBranch. */
export const BRANCH_SWITCH_PERMISSION = 'branches.switch';

interface ScopedRequest {
  user?: AuthenticatedUser;
  query?: Record<string, unknown>;
  body?: unknown;
  params?: Record<string, unknown>;
}

interface RouteArg {
  index: number;
  data?: unknown;
}

/**
 * Keeps each session to its branch, in the API and not only in the screens:
 *
 * - A session that still has to pick its branch (someone who may work at
 *   every branch, just signed in) reaches only the routes marked
 *   @BranchSelectionExempt().
 * - A user assigned to a branch, without branches.switch, can't name another
 *   branch (branchId in the query, body or path is refused), and a list that
 *   takes a branchId filter is filtered to theirs when none is sent: "no
 *   branch" means every branch, which is not theirs to see.
 *
 * Users who may work at every branch, and users with no branch at a business
 * with several (who have always seen them all), are not narrowed.
 */
@Injectable()
export class BranchScopeGuard implements CanActivate {
  /** Whether each handler takes a branchId filter in its query, worked out once. */
  private readonly takesBranchQuery = new Map<unknown, boolean>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<ScopedRequest>();
    const user = request.user;
    if (!user) return true;

    if (user.branchSelectionRequired) {
      const exempt = this.reflector.getAllAndOverride<boolean>(
        BRANCH_SELECTION_EXEMPT_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (exempt) return true;
      throw new DomainException({
        code: 'BRANCH_SELECTION_REQUIRED',
        message: 'Elige la sede en la que vas a trabajar',
        status: HttpStatus.FORBIDDEN,
      });
    }

    const own = user.branchId;
    if (!own || user.permissions.includes(BRANCH_SWITCH_PERMISSION)) {
      return true;
    }

    for (const source of [request.query, request.body, request.params]) {
      const named = branchIdIn(source);
      if (named !== undefined && named !== own) {
        throw new DomainException({
          code: 'BRANCH_FORBIDDEN',
          message: 'No tienes acceso a esa sede',
          status: HttpStatus.FORBIDDEN,
        });
      }
    }

    if (branchIdIn(request.query) === undefined && this.takesBranch(context)) {
      // Express 5 parses req.query on each read; an own property replaces it for this request.
      Object.defineProperty(request, 'query', {
        value: { ...(request.query ?? {}), branchId: own },
        configurable: true,
        enumerable: true,
        writable: true,
      });
    }
    return true;
  }

  private takesBranch(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const cached = this.takesBranchQuery.get(handler);
    if (cached !== undefined) return cached;

    const controller = context.getClass();
    const args =
      (Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, handler.name) as
        Record<string, RouteArg> | undefined) ?? {};
    const types =
      (Reflect.getMetadata(
        'design:paramtypes',
        controller.prototype as object,
        handler.name,
      ) as unknown[] | undefined) ?? [];

    const takes = Object.entries(args).some(([key, arg]) => {
      if (Number(key.split(':')[0]) !== Number(RouteParamtypes.QUERY)) {
        return false;
      }
      if (arg.data === 'branchId') return true;
      const type = types[arg.index];
      return arg.data === undefined && typeof type === 'function'
        ? declaresBranchId(type)
        : false;
    });
    this.takesBranchQuery.set(handler, takes);
    return takes;
  }
}

/** The branchId a request names in one of its parts, if any. */
function branchIdIn(source: unknown): string | undefined {
  if (!source || typeof source !== 'object') return undefined;
  const value = (source as Record<string, unknown>).branchId;
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Whether a query DTO accepts a branchId (it is validated, so whitelisted). */
function declaresBranchId(dto: unknown): boolean {
  return getMetadataStorage()
    .getTargetValidationMetadatas(dto as new () => unknown, '', true, false)
    .some((metadata) => metadata.propertyName === 'branchId');
}
