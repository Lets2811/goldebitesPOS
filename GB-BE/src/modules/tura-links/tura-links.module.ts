import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../../config/app.config';
import { BusinessFeaturesModule } from '../business-features/business-features.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { PlatformFeatureFlagsModule } from '../platform-feature-flags/platform-feature-flags.module';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';
import { TuraLinksController } from './controllers/tura-links.controller';
import { TuraLinksRepository } from './repositories/tura-links.repository';
import { TURA_LINKS_REPOSITORY } from './repositories/tura-links.repository.interface';
import { TuraLinksService } from './services/tura-links.service';

@Module({
  imports: [
    BusinessesModule,
    BusinessFeaturesModule,
    PlatformFeatureFlagsModule,
    UsersModule,
    RolesModule,
    // Signs with the same secret as AuthModule: TURA's access tokens are
    // verified by the same JwtStrategy as everyone else's.
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
  controllers: [TuraLinksController],
  providers: [
    TuraLinksService,
    { provide: TURA_LINKS_REPOSITORY, useClass: TuraLinksRepository },
  ],
})
export class TuraLinksModule {}
