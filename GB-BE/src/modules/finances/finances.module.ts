import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CashSessionsModule } from '../cash-sessions/cash-sessions.module';
import { EmployeesModule } from '../employees/employees.module';
import { FundsModule } from '../funds/funds.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { ExpenseCategoriesController } from './controllers/expense-categories.controller';
import { ExpensesController } from './controllers/expenses.controller';
import { OtherIncomesController } from './controllers/other-incomes.controller';
import { ExpenseAttachmentsController } from './controllers/expense-attachments.controller';
import { SupplierPayablesController } from './controllers/supplier-payables.controller';
import { ReimbursementsController } from './controllers/reimbursements.controller';
import { EXPENSE_CATEGORIES_REPOSITORY, ExpenseCategoriesRepository } from './repositories/expense-categories.repository';
import { ExpensesRepository } from './repositories/expenses.repository';
import { OtherIncomesRepository } from './repositories/other-incomes.repository';
import { ExpenseAttachmentsRepository } from './repositories/expense-attachments.repository';
import { SupplierPayablesRepository } from './repositories/supplier-payables.repository';
import { EXPENSES_REPOSITORY } from './repositories/expenses.repository.interface';
import { ReimbursementObligationsRepository } from './repositories/reimbursement-obligations.repository';
import { REIMBURSEMENT_OBLIGATIONS_REPOSITORY } from './repositories/reimbursement-obligations.repository.interface';
import { ReimbursementPaymentsRepository } from './repositories/reimbursement-payments.repository';
import { REIMBURSEMENT_PAYMENTS_REPOSITORY } from './repositories/reimbursement-payments.repository.interface';
import { ExpenseCategoriesService } from './services/expense-categories.service';
import { ExpensesService } from './services/expenses.service';
import { OtherIncomesService } from './services/other-incomes.service';
import { ExpenseAttachmentsService } from './services/expense-attachments.service';
import { SupplierPayablesService } from './services/supplier-payables.service';
import { ReimbursementsService } from './services/reimbursements.service';

@Module({
  imports: [AuditModule, CashSessionsModule, EmployeesModule, FundsModule, SuppliersModule],
  controllers: [ExpensesController, ExpenseCategoriesController, ReimbursementsController, OtherIncomesController, SupplierPayablesController, ExpenseAttachmentsController],
  providers: [
    ExpensesService,
    ExpenseCategoriesService,
    ReimbursementsService,
    OtherIncomesService,
    OtherIncomesRepository,
    SupplierPayablesService,
    SupplierPayablesRepository,
    ExpenseAttachmentsService,
    ExpenseAttachmentsRepository,
    { provide: EXPENSES_REPOSITORY, useClass: ExpensesRepository },
    { provide: EXPENSE_CATEGORIES_REPOSITORY, useClass: ExpenseCategoriesRepository },
    { provide: REIMBURSEMENT_OBLIGATIONS_REPOSITORY, useClass: ReimbursementObligationsRepository },
    { provide: REIMBURSEMENT_PAYMENTS_REPOSITORY, useClass: ReimbursementPaymentsRepository },
  ],
})
export class FinancesModule {}
