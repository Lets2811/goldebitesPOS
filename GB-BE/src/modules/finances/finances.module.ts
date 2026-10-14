import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CashSessionsModule } from '../cash-sessions/cash-sessions.module';
import { EmployeesModule } from '../employees/employees.module';
import { FundsModule } from '../funds/funds.module';
import { ExpenseCategoriesController } from './controllers/expense-categories.controller';
import { ExpensesController } from './controllers/expenses.controller';
import { ReimbursementsController } from './controllers/reimbursements.controller';
import { EXPENSE_CATEGORIES_REPOSITORY, ExpenseCategoriesRepository } from './repositories/expense-categories.repository';
import { ExpensesRepository } from './repositories/expenses.repository';
import { EXPENSES_REPOSITORY } from './repositories/expenses.repository.interface';
import { ReimbursementObligationsRepository } from './repositories/reimbursement-obligations.repository';
import { REIMBURSEMENT_OBLIGATIONS_REPOSITORY } from './repositories/reimbursement-obligations.repository.interface';
import { ReimbursementPaymentsRepository } from './repositories/reimbursement-payments.repository';
import { REIMBURSEMENT_PAYMENTS_REPOSITORY } from './repositories/reimbursement-payments.repository.interface';
import { ExpenseCategoriesService } from './services/expense-categories.service';
import { ExpensesService } from './services/expenses.service';
import { ReimbursementsService } from './services/reimbursements.service';

@Module({
  imports: [AuditModule, CashSessionsModule, EmployeesModule, FundsModule],
  controllers: [ExpensesController, ExpenseCategoriesController, ReimbursementsController],
  providers: [
    ExpensesService,
    ExpenseCategoriesService,
    ReimbursementsService,
    { provide: EXPENSES_REPOSITORY, useClass: ExpensesRepository },
    { provide: EXPENSE_CATEGORIES_REPOSITORY, useClass: ExpenseCategoriesRepository },
    { provide: REIMBURSEMENT_OBLIGATIONS_REPOSITORY, useClass: ReimbursementObligationsRepository },
    { provide: REIMBURSEMENT_PAYMENTS_REPOSITORY, useClass: ReimbursementPaymentsRepository },
  ],
})
export class FinancesModule {}
