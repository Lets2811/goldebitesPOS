import { Module } from '@nestjs/common';
import { AuditModule } from '../../modules/audit/audit.module';
import { BranchesModule } from '../../modules/branches/branches.module';
import { BusinessFeaturesModule } from '../../modules/business-features/business-features.module';
import { BusinessesModule } from '../../modules/businesses/businesses.module';
import { PlatformFeatureFlagsModule } from '../../modules/platform-feature-flags/platform-feature-flags.module';
import { RolesModule } from '../../modules/roles/roles.module';
import { UsersModule } from '../../modules/users/users.module';
import { PlatformAdminController } from './controllers/platform-admin.controller';
import { PlatformAdminService } from './services/platform-admin.service';

@Module({
  imports: [
    BusinessesModule,
    BranchesModule,
    RolesModule,
    UsersModule,
    BusinessFeaturesModule,
    PlatformFeatureFlagsModule,
    AuditModule,
  ],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService],
})
export class PlatformAdminModule {}
