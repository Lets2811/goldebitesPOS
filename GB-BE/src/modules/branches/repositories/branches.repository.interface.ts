import { DbClient } from '../../../database/types/database.types';
import { BranchRow, PaymentPolicy } from '../domain/branch.interface';
import {
  BranchQuery,
  CreateBranchData,
  UpdateBranchData,
} from '../domain/branch.types';

export interface IBranchesRepository {
  create(data: CreateBranchData, client?: DbClient): Promise<BranchRow>;
  findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<BranchRow | null>;
  findAll(query: BranchQuery): Promise<{ rows: BranchRow[]; total: number }>;
  update(
    id: string,
    businessId: string,
    data: UpdateBranchData,
    client?: DbClient,
  ): Promise<BranchRow | null>;
  setActive(
    id: string,
    businessId: string,
    isActive: boolean,
  ): Promise<BranchRow | null>;
  setPaymentPolicy(
    id: string,
    businessId: string,
    paymentPolicy: PaymentPolicy,
  ): Promise<BranchRow | null>;
  /** Ids of a business's active branches, oldest first, at most `limit` of them. */
  findActiveIds(businessId: string, limit: number): Promise<string[]>;
  /**
   * Deletes a branch nothing refers to. One that has orders, staff or stock
   * cannot be deleted: the database refuses, and its error comes through.
   */
  delete(id: string, businessId: string): Promise<boolean>;
  existsByName(
    businessId: string,
    name: string,
    excludeId?: string,
  ): Promise<boolean>;
}

export const BRANCHES_REPOSITORY = Symbol('BRANCHES_REPOSITORY');
