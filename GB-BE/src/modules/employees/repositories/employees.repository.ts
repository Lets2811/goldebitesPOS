import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { getOffset } from '../../../common/pagination/pagination.util';
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
import { IEmployeesRepository } from './employees.repository.interface';

const SELECT_COLUMNS = `id, business_id, branch_id, role_id, user_id, first_name, last_name, document_type, document_number, phone, email, position, status, hire_date, notes, pay_rate, pay_frequency, created_at, updated_at, deleted_at`;
const SHIFT_COLUMNS = `id, employee_id, day_of_week, start_time, end_time, branch_id`;

interface CountRow {
  count: string;
}

@Injectable()
export class EmployeesRepository implements IEmployeesRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(
    data: CreateEmployeeData,
    client?: DbClient,
  ): Promise<EmployeeRow> {
    const result = await this.db.query<EmployeeRow>(
      `INSERT INTO employees (business_id, branch_id, role_id, first_name, last_name, phone, email, position, hire_date, notes, pay_rate, pay_frequency, document_type, document_number, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, COALESCE($15, 'ACTIVE'))
       RETURNING ${SELECT_COLUMNS}`,
      [
        data.businessId,
        data.branchId ?? null,
        data.roleId ?? null,
        data.firstName,
        data.lastName,
        data.phone ?? null,
        data.email ?? null,
        data.position ?? null,
        data.hireDate ?? null,
        data.notes ?? null,
        data.payRate ?? null,
        data.payFrequency ?? null,
        data.documentType ?? null,
        data.documentNumber ?? null,
        data.status ?? null,
      ],
      client,
    );
    return result.rows[0];
  }

  async findByDocumentNumber(
    businessId: string,
    documentNumber: string,
    client?: DbClient,
  ): Promise<EmployeeRow | null> {
    const result = await this.db.query<EmployeeRow>(
      `SELECT ${SELECT_COLUMNS} FROM employees
       WHERE business_id = $1 AND document_number = $2 AND deleted_at IS NULL`,
      [businessId, documentNumber],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<EmployeeRow | null> {
    const result = await this.db.query<EmployeeRow>(
      `SELECT ${SELECT_COLUMNS} FROM employees WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL`,
      [id, businessId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findByUserId(
    businessId: string,
    userId: string,
    client?: DbClient,
  ): Promise<EmployeeRow | null> {
    const result = await this.db.query<EmployeeRow>(
      `SELECT ${SELECT_COLUMNS} FROM employees WHERE business_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [businessId, userId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findAll(
    query: EmployeeQuery,
  ): Promise<{ rows: EmployeeRow[]; total: number }> {
    const conditions: string[] = ['business_id = $1', 'deleted_at IS NULL'];
    const params: unknown[] = [query.businessId];

    if (query.status) {
      params.push(query.status);
      conditions.push(`status = $${params.length}`);
    }

    if (query.branchId) {
      params.push(query.branchId);
      conditions.push(`branch_id = $${params.length}`);
    }

    if (query.search) {
      params.push(`%${query.search}%`);
      const idx = params.length;
      conditions.push(
        `(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR position ILIKE $${idx} OR document_number ILIKE $${idx})`,
      );
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await this.db.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM employees WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataParams = [
      ...params,
      query.limit,
      getOffset(query.page, query.limit),
    ];
    const rowsResult = await this.db.query<EmployeeRow>(
      `SELECT ${SELECT_COLUMNS}
       FROM employees
       WHERE ${whereClause}
       ORDER BY first_name, last_name
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return { rows: rowsResult.rows, total };
  }

  async update(
    id: string,
    businessId: string,
    data: UpdateEmployeeData,
    client?: DbClient,
  ): Promise<EmployeeRow | null> {
    const result = await this.db.query<EmployeeRow>(
      `UPDATE employees
       SET branch_id = COALESCE($3, branch_id),
           role_id = COALESCE($4, role_id),
           first_name = COALESCE($5, first_name),
           last_name = COALESCE($6, last_name),
           phone = COALESCE($7, phone),
           email = COALESCE($8, email),
           position = COALESCE($9, position),
           hire_date = COALESCE($10, hire_date),
           notes = COALESCE($11, notes),
           pay_rate = COALESCE($12, pay_rate),
           pay_frequency = COALESCE($13, pay_frequency),
           document_type = COALESCE($14, document_type),
           document_number = COALESCE($15, document_number),
           status = COALESCE($16, status)
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [
        id,
        businessId,
        data.branchId ?? null,
        data.roleId ?? null,
        data.firstName ?? null,
        data.lastName ?? null,
        data.phone ?? null,
        data.email ?? null,
        data.position ?? null,
        data.hireDate ?? null,
        data.notes ?? null,
        data.payRate ?? null,
        data.payFrequency ?? null,
        data.documentType ?? null,
        data.documentNumber ?? null,
        data.status ?? null,
      ],
      client,
    );
    return result.rows[0] ?? null;
  }

  /** Narrower than update() on purpose — touches only pay_frequency, so a self-service caller can never reach pay_rate through this path. */
  async updatePayFrequency(
    id: string,
    businessId: string,
    payFrequency: EmployeePayFrequency,
    client?: DbClient,
  ): Promise<EmployeeRow | null> {
    const result = await this.db.query<EmployeeRow>(
      `UPDATE employees SET pay_frequency = $3
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, payFrequency],
      client,
    );
    return result.rows[0] ?? null;
  }

  async setStatus(
    id: string,
    businessId: string,
    status: EmployeeStatus,
  ): Promise<EmployeeRow | null> {
    const result = await this.db.query<EmployeeRow>(
      `UPDATE employees SET status = $3
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, status],
    );
    return result.rows[0] ?? null;
  }

  async softDelete(
    id: string,
    businessId: string,
  ): Promise<EmployeeRow | null> {
    const result = await this.db.query<EmployeeRow>(
      `UPDATE employees SET deleted_at = now()
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [id, businessId],
    );
    return result.rows[0] ?? null;
  }

  async setUserId(
    id: string,
    businessId: string,
    userId: string,
    client?: DbClient,
  ): Promise<EmployeeRow | null> {
    const result = await this.db.query<EmployeeRow>(
      `UPDATE employees SET user_id = $3
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, userId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findShifts(
    employeeId: string,
    client?: DbClient,
  ): Promise<EmployeeShiftRow[]> {
    const result = await this.db.query<EmployeeShiftRow>(
      `SELECT ${SHIFT_COLUMNS} FROM employee_shifts WHERE employee_id = $1 ORDER BY day_of_week, start_time`,
      [employeeId],
      client,
    );
    return result.rows;
  }

  async replaceShifts(
    employeeId: string,
    shifts: ShiftInput[],
    client?: DbClient,
  ): Promise<EmployeeShiftRow[]> {
    await this.db.query(
      `DELETE FROM employee_shifts WHERE employee_id = $1`,
      [employeeId],
      client,
    );

    const inserted: EmployeeShiftRow[] = [];
    for (const shift of shifts) {
      const result = await this.db.query<EmployeeShiftRow>(
        `INSERT INTO employee_shifts (employee_id, day_of_week, start_time, end_time, branch_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${SHIFT_COLUMNS}`,
        [
          employeeId,
          shift.dayOfWeek,
          shift.startTime,
          shift.endTime,
          shift.branchId ?? null,
        ],
        client,
      );
      inserted.push(result.rows[0]);
    }
    return inserted;
  }
}
