import { DbClient } from '../../../database/types/database.types';
import { ExpenseCategoryTotalRow, ExpenseDailyTotalRow, ExpenseRow } from '../domain/expense.interface';
import {
  CreateExpenseData,
  ExpenseQuery,
  ExpenseSummaryQuery,
  UpdateExpenseData,
} from '../domain/expense.types';

export interface UpdateExpenseSourceData {
  paymentSource: string;
  payerEmployeeId?: string | null;
  payerName?: string | null;
  cashSessionId: string | null;
  cashMovementId: string | null;
  fundMovementId: string | null;
}

export interface IExpensesRepository {
  create(data: CreateExpenseData, client?: DbClient): Promise<ExpenseRow>;
  findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<ExpenseRow | null>;
  findAll(query: ExpenseQuery): Promise<{ rows: ExpenseRow[]; total: number }>;
  update(
    id: string,
    businessId: string,
    data: UpdateExpenseData,
  ): Promise<ExpenseRow | null>;
  /** BR-08: the only way payment_source (and its pointer columns) ever changes — never via update(). */
  updateSource(
    id: string,
    data: UpdateExpenseSourceData,
    client: DbClient,
  ): Promise<ExpenseRow>;
  softDelete(id: string, businessId: string, client?: DbClient): Promise<ExpenseRow | null>;
  findSupplierNames(supplierIds: string[]): Promise<Map<string, string>>;
  /** Total spent on each day of the range that has expenses, oldest first. */
  getDailyTotals(query: ExpenseSummaryQuery): Promise<ExpenseDailyTotalRow[]>;
  getSummaryByCategory(
    query: ExpenseSummaryQuery,
  ): Promise<ExpenseCategoryTotalRow[]>;
}

export const EXPENSES_REPOSITORY = Symbol('EXPENSES_REPOSITORY');
