/** A kind of expense, as a business defines it. Expenses point at it by `code`, which never changes. */
export interface ExpenseCategoryDefinition {
  id: string;
  businessId: string;
  code: string;
  name: string;
  /** Whether expenses of this kind are the cost of what was sold (they come off sales to give gross margin). */
  isCostOfSales: boolean;
  /** An inactive kind keeps its past expenses but cannot be chosen for new ones. */
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseCategoryRow {
  id: string;
  business_id: string;
  code: string;
  name: string;
  is_cost_of_sales: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateExpenseCategoryData {
  businessId: string;
  name: string;
  isCostOfSales?: boolean;
}

export interface UpdateExpenseCategoryData {
  name?: string;
  isCostOfSales?: boolean;
  isActive?: boolean;
}

/** The kinds every business starts with: the five that were fixed before the list became editable. */
export const DEFAULT_EXPENSE_CATEGORIES = [
  { code: 'COGS', name: 'Costo de ventas', isCostOfSales: true },
  { code: 'OPERATING', name: 'Gastos operativos', isCostOfSales: false },
  { code: 'PAYROLL', name: 'Nómina', isCostOfSales: false },
  { code: 'MARKETING', name: 'Marketing', isCostOfSales: false },
  { code: 'OTHER', name: 'Otros', isCostOfSales: false },
] as const;
