import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { AdminConfig } from '../config';
import {
  ADMIN_AUDIENCE,
  IS_PUBLIC_KEY,
  SKIP_MUST_CHANGE_PASSWORD_KEY,
  type AdminJwtPayload,
  type AdminPrincipal,
} from './auth.decorators';

interface AdminRequest {
  headers: { authorization?: string };
  admin?: AdminPrincipal;
}

/** Every route needs a POS-ADMIN session, except those marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<AdminRequest>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    let payload: AdminJwtPayload;
    try {
      payload = this.jwtService.verify<AdminJwtPayload>(token, {
        secret: this.configService.getOrThrow<AdminConfig>('admin').jwtSecret,
        audience: ADMIN_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('Invalid or missing access token');
    }
    request.admin = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      mustChangePassword: payload.mustChangePassword,
    };
    if (payload.mustChangePassword && !this.reflector.getAllAndOverride<boolean>(SKIP_MUST_CHANGE_PASSWORD_KEY, targets)) {
      throw new ForbiddenException({
        message: 'You must change your password before continuing',
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
    }
    return true;
  }
}
