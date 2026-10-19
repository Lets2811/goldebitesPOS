import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../../config/app.config';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { JwtPayload } from '../domain/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const appConfig = configService.getOrThrow<AppConfig>('app');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: appConfig.jwt.accessSecret,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      businessId: payload.businessId,
      branchId: payload.branchId,
      roleId: payload.roleId,
      roleName: payload.roleName,
      permissions: payload.permissions,
      enabledFeatures: payload.enabledFeatures,
      mustChangePassword: payload.mustChangePassword,
      turaLinkId: payload.turaLinkId,
    };
  }
}
