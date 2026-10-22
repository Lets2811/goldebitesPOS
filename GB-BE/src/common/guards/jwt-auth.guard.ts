import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { INTERNAL_ROUTE_KEY } from '../../internal/internal-api';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // The internal API (POS-ADMIN) is checked by InternalApiGuard, not by POS sessions.
    const isInternalRoute = this.reflector.getAllAndOverride<boolean>(
      INTERNAL_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic || isInternalRoute) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser | false): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or missing access token');
    }
    return user;
  }
}
