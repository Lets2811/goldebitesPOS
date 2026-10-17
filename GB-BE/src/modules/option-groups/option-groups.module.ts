import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OptionGroupsController } from './controllers/option-groups.controller';
import { OptionGroupsRepository } from './repositories/option-groups.repository';
import { OPTION_GROUPS_REPOSITORY } from './repositories/option-groups.repository.interface';
import { OptionGroupsService } from './services/option-groups.service';

@Module({
  imports: [AuditModule],
  controllers: [OptionGroupsController],
  providers: [
    OptionGroupsService,
    { provide: OPTION_GROUPS_REPOSITORY, useClass: OptionGroupsRepository },
  ],
  exports: [OptionGroupsService],
})
export class OptionGroupsModule {}
