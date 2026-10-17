import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { RosterShiftRow } from '../domain/roster.types';
import { IRosterRepository } from './roster.repository.interface';

@Injectable()
export class RosterRepository implements IRosterRepository {
  constructor(private readonly db: DatabaseService) {}

  async findShifts(businessId: string): Promise<RosterShiftRow[]> {
    const result = await this.db.query<RosterShiftRow>(
      `SELECT e.id AS employee_id, e.first_name, e.last_name, e.role_id,
              e.branch_id AS employee_branch_id, e.status, e.hire_date::text AS hire_date,
              s.day_of_week, to_char(s.start_time, 'HH24:MI') AS start_time,
              to_char(s.end_time, 'HH24:MI') AS end_time, s.branch_id AS shift_branch_id
       FROM employees e
       JOIN employee_shifts s ON s.employee_id = e.id
       WHERE e.business_id = $1 AND e.deleted_at IS NULL AND e.status <> 'INACTIVE'
       ORDER BY s.start_time, e.first_name, e.last_name`,
      [businessId],
    );
    return result.rows;
  }
}
