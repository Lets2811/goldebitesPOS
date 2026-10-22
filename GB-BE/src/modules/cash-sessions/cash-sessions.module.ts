import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BranchesModule } from '../branches/branches.module';
import { CashSessionsController } from './controllers/cash-sessions.controller';
import { MasterKeysController } from './controllers/master-keys.controller';
import { MasterKeysService } from './services/master-keys.service';
import { CashSessionsRepository } from './repositories/cash-sessions.repository';
import { CASH_SESSIONS_REPOSITORY } from './repositories/cash-sessions.repository.interface';
import { CashSessionsService } from './services/cash-sessions.service';

@Module({
  imports: [BranchesModule, AuditModule],
  controllers: [CashSessionsController, MasterKeysController],
  providers: [
    MasterKeysService,
    CashSessionsService,
    { provide: CASH_SESSIONS_REPOSITORY, useClass: CashSessionsRepository },
  ],
  exports: [CashSessionsService],
})
export class CashSessionsModule {}
