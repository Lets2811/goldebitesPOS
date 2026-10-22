import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainException } from '../exceptions';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { SKIP_MUST_CHANGE_PASSWORD_KEY } from '../decorators/skip-must-change-password.decorator';

interface RequestWithUser {
  user?: AuthenticatedUser;
}

/**
 * Blocks every endpoint except the ones marked @SkipMustChangePassword()
 * (change-password, logout) while the account's mustChangePassword flag is
 * set — a real backend block, not just a frontend redirect, so an
 * auto-provisioned or reset temporary/default password can't be used past
 * the first request.
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_MUST_CHANGE_PASSWORD_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skip) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();

    if (user?.mustChangePassword) {
      throw new DomainException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'You must change your password before continuing',
        status: HttpStatus.FORBIDDEN,
      });
    }

    return true;
  }
}
