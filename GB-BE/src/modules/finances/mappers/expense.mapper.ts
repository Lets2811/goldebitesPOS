import {
  Expense,
  ExpenseCategoryTotalRow,
  ExpenseRow,
} from '../domain/expense.interface';
import { ExpenseCategoryTotal } from '../domain/expense.types';

export class ExpenseMapper {
  static toDomain(row: ExpenseRow): Expense {
    return {
      id: row.id,
      businessId: row.business_id,
      branchId: row.branch_id,
      category: row.category,
      name: row.name,
      description: row.description,
      responsible: row.responsible,
      amount: parseFloat(row.amount),
      expenseDate: row.expense_date,
      paymentSource: row.payment_source,
      payerEmployeeId: row.payer_employee_id,
      payerName: row.payer_name,
      supplierId: row.supplier_id,
      cashSessionId: row.cash_session_id,
      cashMovementId: row.cash_movement_id,
      fundMovementId: row.fund_movement_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static categoryTotalToDomain(
    row: ExpenseCategoryTotalRow,
  ): ExpenseCategoryTotal {
    return {
      category: row.category,
      total: parseFloat(row.total),
    };
  }
}
