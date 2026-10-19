import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';

/**
 * The internal API: what POS-ADMIN (the Golden Bites team's Admin, its own
 * service) asks of the POS — create businesses, their branches, modules,
 * Factus and TURA. Not for browsers: callers present INTERNAL_API_KEY, the
 * public nginx never forwards /api/v1/internal, and POS-ADMIN reaches this
 * service directly on the private network. POS-ADMIN signs its users in
 * itself and says who acts in X-Platform-User-Id, for the audit log.
 */
export const INTERNAL_ROUTE_KEY = 'isInternalRoute';

export const InternalRoute = () => SetMetadata(INTERNAL_ROUTE_KEY, true);

const KEY_HEADER = 'x-internal-key';
const ACTOR_HEADER = 'x-platform-user-id';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface InternalRequest {
  headers: Record<string, string | string[] | undefined>;
  internalActorId?: string;
}

/** The Golden Bites team member acting through POS-ADMIN (a platform_users id). */
export const InternalActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<InternalRequest>().internalActorId,
);

@Injectable()
export class InternalApiGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const internal = this.reflector.getAllAndOverride<boolean>(
      INTERNAL_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!internal) return true;

    const request = context.switchToHttp().getRequest<InternalRequest>();
    const expected = this.configService.get<string>('INTERNAL_API_KEY') ?? '';
    const presented = String(request.headers[KEY_HEADER] ?? '');
    const valid =
      expected.length >= 32 &&
      presented.length === expected.length &&
      timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
    // Not found rather than unauthorized: nothing here is meant to be found from outside.
    if (!valid) throw new NotFoundException();

    const actor = String(request.headers[ACTOR_HEADER] ?? '');
    request.internalActorId = UUID.test(actor) ? actor : undefined;
    return true;
  }
}
