import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleException,
  ConflictException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import { isPgDatabaseError } from '../../../common/utils/pg-error-mapper';
import { PaginatedResult } from '../../../common/pagination/paginated-result.interface';
import { buildPaginationMeta } from '../../../common/pagination/pagination.util';
import { AuditService } from '../../audit/services/audit.service';
import { Branch, BranchRow, PaymentPolicy } from '../domain/branch.interface';
import {
  BranchQuery,
  CreateBranchData,
  UpdateBranchData,
} from '../domain/branch.types';
import { BranchMapper } from '../mappers/branch.mapper';
import { BRANCHES_REPOSITORY } from '../repositories/branches.repository.interface';
import type { IBranchesRepository } from '../repositories/branches.repository.interface';

const FOREIGN_KEY_VIOLATION = '23503';

@Injectable()
export class BranchesService {
  constructor(
    @Inject(BRANCHES_REPOSITORY)
    private readonly branchesRepository: IBranchesRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(data: CreateBranchData, actorUserId?: string): Promise<Branch> {
    const nameTaken = await this.branchesRepository.existsByName(
      data.businessId,
      data.name,
    );
    if (nameTaken) {
      throw new ConflictException(
        `A branch named "${data.name}" already exists`,
        'BRANCH_NAME_TAKEN',
      );
    }

    const row = await this.branchesRepository.create(data);
    await this.auditService.record({
      businessId: data.businessId,
      branchId: row.id,
      userId: actorUserId,
      entityType: 'branch',
      entityId: row.id,
      action: 'CREATE',
      newValues: { name: row.name },
    });
    return BranchMapper.toDomain(row);
  }

  async findAll(query: BranchQuery): Promise<PaginatedResult<Branch>> {
    const { rows, total } = await this.branchesRepository.findAll(query);
    return {
      data: rows.map((row) => BranchMapper.toDomain(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(businessId: string, id: string): Promise<Branch> {
    const row = await this.getOwnedBranchOrFail(businessId, id);
    return BranchMapper.toDomain(row);
  }

  async update(
    businessId: string,
    id: string,
    data: UpdateBranchData,
    actorUserId?: string,
  ): Promise<Branch> {
    await this.getOwnedBranchOrFail(businessId, id);

    if (data.name) {
      const nameTaken = await this.branchesRepository.existsByName(
        businessId,
        data.name,
        id,
      );
      if (nameTaken) {
        throw new ConflictException(
          `A branch named "${data.name}" already exists`,
          'BRANCH_NAME_TAKEN',
        );
      }
    }

    const row = await this.branchesRepository.update(id, businessId, data);
    if (!row) {
      throw new EntityNotFoundException('Branch', id);
    }
    await this.auditService.record({
      businessId,
      branchId: id,
      userId: actorUserId,
      entityType: 'branch',
      entityId: id,
      action: 'UPDATE',
      newValues: data as Record<string, unknown>,
    });
    return BranchMapper.toDomain(row);
  }

  /**
   * The branch everyone at a single-site business works at, or null for a
   * business with several (or none) active. Having several branches is an
   * add-on the platform sells; without it a business has just the one it was
   * created with, and nobody needs to be assigned to it: this is the branch
   * they are taken to be at.
   */
  async findOnlyActiveBranchId(businessId: string): Promise<string | null> {
    const ids = await this.branchesRepository.findActiveIds(businessId, 2);
    return ids.length === 1 ? ids[0] : null;
  }

  /** The business's first active branch (the one it was created with, unless closed). */
  async firstActiveBranchId(businessId: string): Promise<string | null> {
    const ids = await this.branchesRepository.findActiveIds(businessId, 1);
    return ids[0] ?? null;
  }

  /** Whether the business has more than one active branch, so there is a branch to choose. */
  async hasSeveralActive(businessId: string): Promise<boolean> {
    const ids = await this.branchesRepository.findActiveIds(businessId, 2);
    return ids.length > 1;
  }

  /** Whether a branch is one of the business's active ones. */
  async isActiveBranch(businessId: string, branchId: string): Promise<boolean> {
    const ids = await this.branchesRepository.findActiveIds(businessId, 1000);
    return ids.includes(branchId);
  }

  /** Sets how many tables a branch has: the one thing about a branch its own business manages. */
  async setTableCount(
    businessId: string,
    id: string,
    tableCount: number,
    actorUserId?: string,
  ): Promise<Branch> {
    return this.update(businessId, id, { tableCount }, actorUserId);
  }

  /**
   * Deletes a branch that was never used. One with orders, staff or stock is
   * kept (deactivate it instead), and so is a business's last active branch.
   */
  async remove(
    businessId: string,
    id: string,
    actorUserId?: string,
  ): Promise<void> {
    const branch = await this.getOwnedBranchOrFail(businessId, id);
    if (branch.is_active) {
      await this.assertNotLastActive(businessId, id);
    }
    try {
      await this.branchesRepository.delete(id, businessId);
    } catch (error) {
      if (isPgDatabaseError(error) && error.code === FOREIGN_KEY_VIOLATION) {
        throw new ConflictException(
          'Esta sede tiene información registrada (pedidos, personal o inventario) y no se puede eliminar. Desactívala en su lugar.',
          'BRANCH_IN_USE',
        );
      }
      throw error;
    }
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'branch',
      entityId: id,
      action: 'DELETE',
      oldValues: { name: branch.name },
    });
  }

  async setActive(
    businessId: string,
    id: string,
    isActive: boolean,
    actorUserId?: string,
  ): Promise<Branch> {
    await this.getOwnedBranchOrFail(businessId, id);
    if (!isActive) {
      await this.assertNotLastActive(businessId, id);
    }
    const row = await this.branchesRepository.setActive(
      id,
      businessId,
      isActive,
    );
    if (!row) {
      throw new EntityNotFoundException('Branch', id);
    }
    await this.auditService.record({
      businessId,
      branchId: id,
      userId: actorUserId,
      entityType: 'branch',
      entityId: id,
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
    });
    return BranchMapper.toDomain(row);
  }

  async setPaymentPolicy(
    businessId: string,
    id: string,
    paymentPolicy: PaymentPolicy,
    actorUserId?: string,
  ): Promise<Branch> {
    const existing = await this.getOwnedBranchOrFail(businessId, id);
    const row = await this.branchesRepository.setPaymentPolicy(
      id,
      businessId,
      paymentPolicy,
    );
    if (!row) {
      throw new EntityNotFoundException('Branch', id);
    }
    await this.auditService.record({
      businessId,
      branchId: id,
      userId: actorUserId,
      entityType: 'branch',
      entityId: id,
      action: 'SET_PAYMENT_POLICY',
      oldValues: { paymentPolicy: existing.payment_policy },
      newValues: { paymentPolicy },
    });
    return BranchMapper.toDomain(row);
  }

  /** A business always keeps one active branch: everything it records happens at one. */
  private async assertNotLastActive(
    businessId: string,
    id: string,
  ): Promise<void> {
    const ids = await this.branchesRepository.findActiveIds(businessId, 2);
    if (ids.length === 1 && ids[0] === id) {
      throw new BusinessRuleException(
        'Un negocio necesita al menos una sede activa.',
        'LAST_ACTIVE_BRANCH',
      );
    }
  }

  private async getOwnedBranchOrFail(
    businessId: string,
    id: string,
  ): Promise<BranchRow> {
    const row = await this.branchesRepository.findById(id, businessId);
    if (!row) {
      throw new EntityNotFoundException('Branch', id);
    }
    return row;
  }
}
