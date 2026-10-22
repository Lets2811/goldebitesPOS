import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

/** The audience of POS-ADMIN's tokens. */
export const ADMIN_AUDIENCE = 'pos-admin';

export const IS_PUBLIC_KEY = 'isPublic';
/** No session needed (sign-in, refresh, sign-out, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const SKIP_MUST_CHANGE_PASSWORD_KEY = 'skipMustChangePassword';
/** Reachable while the account must still change its password. */
export const SkipMustChangePassword = () => SetMetadata(SKIP_MUST_CHANGE_PASSWORD_KEY, true);

/** Who is calling (set on the request by AuthGuard). */
export interface AdminPrincipal {
  id: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
}

export interface AdminJwtPayload {
  sub: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
}

export const CurrentAdmin = createParamDecorator(
  (field: keyof AdminPrincipal | undefined, context: ExecutionContext) => {
    const principal = context.switchToHttp().getRequest<{ admin?: AdminPrincipal }>().admin;
    return field ? principal?.[field] : principal;
  },
);
