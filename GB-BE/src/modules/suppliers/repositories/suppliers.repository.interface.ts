import { DbClient } from '../../../database/types/database.types';
import { SupplierRow } from '../domain/supplier.interface';
import {
  CreateSupplierData,
  SupplierQuery,
  UpdateSupplierData,
} from '../domain/supplier.types';

export interface ISuppliersRepository {
  create(data: CreateSupplierData, client?: DbClient): Promise<SupplierRow>;
  findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<SupplierRow | null>;
  findAll(
    query: SupplierQuery,
  ): Promise<{ rows: SupplierRow[]; total: number }>;
  update(
    id: string,
    businessId: string,
    data: UpdateSupplierData,
    client?: DbClient,
  ): Promise<SupplierRow | null>;
  setActive(
    id: string,
    businessId: string,
    isActive: boolean,
  ): Promise<SupplierRow | null>;
  findActiveByName(businessId: string, name: string): Promise<SupplierRow | null>;
}

export const SUPPLIERS_REPOSITORY = Symbol('SUPPLIERS_REPOSITORY');
