import { DbClient } from '../../../database/types/database.types';
import { EmployeeRow, EmployeeShiftRow } from '../domain/employee.interface';
import {
  CreateEmployeeData,
  EmployeePayFrequency,
  EmployeeQuery,
  EmployeeStatus,
  ShiftInput,
  UpdateEmployeeData,
} from '../domain/employee.types';

export interface IEmployeesRepository {
  create(data: CreateEmployeeData, client?: DbClient): Promise<EmployeeRow>;
  findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<EmployeeRow | null>;
  findByUserId(
    businessId: string,
    userId: string,
    client?: DbClient,
  ): Promise<EmployeeRow | null>;
  findByDocumentNumber(
    businessId: string,
    documentNumber: string,
    client?: DbClient,
  ): Promise<EmployeeRow | null>;
  findAll(
    query: EmployeeQuery,
  ): Promise<{ rows: EmployeeRow[]; total: number }>;
  update(
    id: string,
    businessId: string,
    data: UpdateEmployeeData,
    client?: DbClient,
  ): Promise<EmployeeRow | null>;
  updatePayFrequency(
    id: string,
    businessId: string,
    payFrequency: EmployeePayFrequency,
    client?: DbClient,
  ): Promise<EmployeeRow | null>;
  setStatus(
    id: string,
    businessId: string,
    status: EmployeeStatus,
  ): Promise<EmployeeRow | null>;
  softDelete(id: string, businessId: string): Promise<EmployeeRow | null>;
  setUserId(
    id: string,
    businessId: string,
    userId: string,
    client?: DbClient,
  ): Promise<EmployeeRow | null>;
  findShifts(
    employeeId: string,
    client?: DbClient,
  ): Promise<EmployeeShiftRow[]>;
  replaceShifts(
    employeeId: string,
    shifts: ShiftInput[],
    client?: DbClient,
  ): Promise<EmployeeShiftRow[]>;
}

export const EMPLOYEES_REPOSITORY = Symbol('EMPLOYEES_REPOSITORY');
