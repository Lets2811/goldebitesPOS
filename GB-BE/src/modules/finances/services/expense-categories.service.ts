import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  BusinessRuleException,
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { AuditService } from '../../audit/services/audit.service';
import {
  CreateExpenseCategoryData,
  ExpenseCategoryDefinition,
  ExpenseCategoryRow,
  UpdateExpenseCategoryData,
} from '../domain/expense-category.interface';
import { EXPENSE_CATEGORIES_REPOSITORY } from '../repositories/expense-categories.repository';
import type { IExpenseCategoriesRepository } from '../repositories/expense-categories.repository';

function toDomain(row: ExpenseCategoryRow): ExpenseCategoryDefinition {
  return {
    id: row.id,
    businessId: row.business_id,
    code: row.code,
    name: row.name,
    isCostOfSales: row.is_cost_of_sales,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** A code for a kind the business adds: opaque on purpose, since the name is what people see and it can change. */
function generateCode(): string {
  return `C${randomBytes(6).toString('hex').toUpperCase()}`;
}

/** The kinds of expense a business records: a list it manages itself. */
@Injectable()
export class ExpenseCategoriesService {
  constructor(
    @Inject(EXPENSE_CATEGORIES_REPOSITORY)
    private readonly categoriesRepository: IExpenseCategoriesRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(businessId: string): Promise<ExpenseCategoryDefinition[]> {
    let rows = await this.categoriesRepository.findAll(businessId);
    if (rows.length === 0) {
      // A business created after the list became editable has none yet: it starts with the usual ones.
      await this.categoriesRepository.insertDefaults(businessId);
      rows = await this.categoriesRepository.findAll(businessId);
    }
    return rows.map(toDomain);
  }

  async create(
    data: CreateExpenseCategoryData,
    actorUserId?: string,
  ): Promise<ExpenseCategoryDefinition> {
    const name = data.name.trim();
    await this.assertNameFree(data.businessId, name);
    const row = await this.categoriesRepository.create({
      businessId: data.businessId,
      code: generateCode(),
      name,
      isCostOfSales: data.isCostOfSales ?? false,
    });
    await this.auditService.record({
      businessId: data.businessId,
      userId: actorUserId,
      entityType: 'expense_category',
      entityId: row.id,
      action: 'CREATE',
      newValues: { name: row.name, isCostOfSales: row.is_cost_of_sales },
    });
    return toDomain(row);
  }

  async update(
    businessId: string,
    id: string,
    data: UpdateExpenseCategoryData,
    actorUserId?: string,
  ): Promise<ExpenseCategoryDefinition> {
    const existing = await this.getOwnedOrFail(businessId, id);
    const name = data.name?.trim();
    if (name !== undefined) {
      await this.assertNameFree(businessId, name, id);
    }
    if (data.isActive === false && existing.is_active) {
      await this.assertNotLastActive(businessId, id);
    }
    const row = await this.categoriesRepository.update(id, businessId, {
      ...data,
      name,
    });
    if (!row) {
      throw new EntityNotFoundException('ExpenseCategory', id);
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'expense_category',
      entityId: id,
      action: 'UPDATE',
      oldValues: {
        name: existing.name,
        isCostOfSales: existing.is_cost_of_sales,
        isActive: existing.is_active,
      },
      newValues: {
        name: row.name,
        isCostOfSales: row.is_cost_of_sales,
        isActive: row.is_active,
      },
    });
    return toDomain(row);
  }

  /**
   * Removes a kind nobody ever used. One with expenses under it stays, so
   * those expenses keep a name: it can be deactivated instead, which takes it
   * off the list for new expenses.
   */
  async remove(
    businessId: string,
    id: string,
    actorUserId?: string,
  ): Promise<void> {
    const existing = await this.getOwnedOrFail(businessId, id);
    const used = await this.categoriesRepository.countExpenses(
      businessId,
      existing.code,
    );
    if (used > 0) {
      throw new ConflictException(
        `"${existing.name}" has ${used} expense(s) recorded under it and cannot be deleted; deactivate it instead`,
        'EXPENSE_CATEGORY_IN_USE',
      );
    }
    if (existing.is_active) {
      await this.assertNotLastActive(businessId, id);
    }
    await this.categoriesRepository.delete(id, businessId);
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'expense_category',
      entityId: id,
      action: 'DELETE',
      oldValues: { name: existing.name },
    });
  }

  /** Used by ExpensesService: an expense can only be recorded under a kind the business has and still uses. */
  async assertUsable(businessId: string, code: string): Promise<void> {
    const categories = await this.findAll(businessId);
    const category = categories.find((candidate) => candidate.code === code);
    if (!category) {
      throw new BusinessRuleException(
        `"${code}" is not one of this business's expense categories`,
        'UNKNOWN_EXPENSE_CATEGORY',
      );
    }
    if (!category.isActive) {
      throw new BusinessRuleException(
        `The expense category "${category.name}" is inactive`,
        'INACTIVE_EXPENSE_CATEGORY',
      );
    }
  }

  private async assertNameFree(
    businessId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    if (
      await this.categoriesRepository.existsByName(businessId, name, excludeId)
    ) {
      throw new ConflictException(
        `An expense category named "${name}" already exists`,
        'EXPENSE_CATEGORY_NAME_TAKEN',
      );
    }
  }

  /** Recording an expense needs a kind to record it under. */
  private async assertNotLastActive(
    businessId: string,
    id: string,
  ): Promise<void> {
    const rows = await this.categoriesRepository.findAll(businessId);
    if (!rows.some((row) => row.is_active && row.id !== id)) {
      throw new BusinessRuleException(
        'A business needs at least one active expense category',
        'LAST_ACTIVE_EXPENSE_CATEGORY',
      );
    }
  }

  private async getOwnedOrFail(
    businessId: string,
    id: string,
  ): Promise<ExpenseCategoryRow> {
    const row = await this.categoriesRepository.findById(id, businessId);
    if (!row) {
      throw new EntityNotFoundException('ExpenseCategory', id);
    }
    return row;
  }
}
