import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppConfig } from '../../config/app.config';
import { AuditModule } from '../audit/audit.module';
import { BranchesModule } from '../branches/branches.module';
import { BusinessFeaturesModule } from '../business-features/business-features.module';
import { PlatformFeatureFlagsModule } from '../platform-feature-flags/platform-feature-flags.module';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './controllers/auth.controller';
import { LoginAttemptRepository } from './repositories/login-attempt.repository';
import { LOGIN_ATTEMPT_REPOSITORY } from './repositories/login-attempt.repository.interface';
import { PasswordResetTokenRepository } from './repositories/password-reset-token.repository';
import { PASSWORD_RESET_TOKEN_REPOSITORY } from './repositories/password-reset-token.repository.interface';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { REFRESH_TOKEN_REPOSITORY } from './repositories/refresh-token.repository.interface';
import { AuthService } from './services/auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    UsersModule,
    RolesModule,
    BusinessFeaturesModule,
    PlatformFeatureFlagsModule,
    BranchesModule,
    AuditModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const appConfig = configService.getOrThrow<AppConfig>('app');
        return {
          secret: appConfig.jwt.accessSecret,
          // JwtModuleOptions types expiresIn as a template-literal `StringValue`
          // (from `ms`), but our value is a plain runtime string read from env.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          signOptions: { expiresIn: appConfig.jwt.accessExpiresIn as any },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: RefreshTokenRepository },
    {
      provide: PASSWORD_RESET_TOKEN_REPOSITORY,
      useClass: PasswordResetTokenRepository,
    },
    { provide: LOGIN_ATTEMPT_REPOSITORY, useClass: LoginAttemptRepository },
  ],
})
export class AuthModule {}
