import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BranchesModule } from '../branches/branches.module';
import { EmployeesModule } from '../employees/employees.module';
import { RolesModule } from '../roles/roles.module';
import { HrTasksController } from './controllers/hr-tasks.controller';
import { HrController } from './controllers/hr.controller';
import { LeaveRequestsController } from './controllers/leave-requests.controller';
import { RosterController } from './controllers/roster.controller';
import { BranchRulesRepository } from './repositories/branch-rules.repository';
import { BRANCH_RULES_REPOSITORY } from './repositories/branch-rules.repository.interface';
import { HrTasksRepository } from './repositories/hr-tasks.repository';
import { HR_TASKS_REPOSITORY } from './repositories/hr-tasks.repository.interface';
import { LeaveRequestsRepository } from './repositories/leave-requests.repository';
import { LEAVE_REQUESTS_REPOSITORY } from './repositories/leave-requests.repository.interface';
import { RosterRepository } from './repositories/roster.repository';
import { ROSTER_REPOSITORY } from './repositories/roster.repository.interface';
import { BranchRulesService } from './services/branch-rules.service';
import { HrProfileService } from './services/hr-profile.service';
import { HrTasksService } from './services/hr-tasks.service';
import { LeaveRequestsService } from './services/leave-requests.service';
import { RosterService } from './services/roster.service';

@Module({
  imports: [AuditModule, BranchesModule, EmployeesModule, RolesModule],
  controllers: [HrController, HrTasksController, LeaveRequestsController, RosterController],
  providers: [
    BranchRulesService,
    HrProfileService,
    HrTasksService,
    LeaveRequestsService,
    RosterService,
    { provide: BRANCH_RULES_REPOSITORY, useClass: BranchRulesRepository },
    { provide: HR_TASKS_REPOSITORY, useClass: HrTasksRepository },
    { provide: LEAVE_REQUESTS_REPOSITORY, useClass: LeaveRequestsRepository },
    { provide: ROSTER_REPOSITORY, useClass: RosterRepository },
  ],
  exports: [BranchRulesService],
})
export class HrModule {}
