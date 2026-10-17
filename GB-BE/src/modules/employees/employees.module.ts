import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BranchesModule } from '../branches/branches.module';
import { UsersModule } from '../users/users.module';
import { EmployeesController } from './controllers/employees.controller';
import { EmployeesRepository } from './repositories/employees.repository';
import { EMPLOYEES_REPOSITORY } from './repositories/employees.repository.interface';
import { EmployeesService } from './services/employees.service';

@Module({
  imports: [UsersModule, AuditModule, BranchesModule],
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    { provide: EMPLOYEES_REPOSITORY, useClass: EmployeesRepository },
  ],
  exports: [EmployeesService, EMPLOYEES_REPOSITORY],
})
export class EmployeesModule {}
