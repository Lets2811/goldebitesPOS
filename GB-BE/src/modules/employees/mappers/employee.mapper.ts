import {
  Employee,
  EmployeeRow,
  EmployeeShift,
  EmployeeShiftRow,
} from '../domain/employee.interface';

export class EmployeeMapper {
  static toDomain(row: EmployeeRow): Employee {
    return {
      id: row.id,
      businessId: row.business_id,
      branchId: row.branch_id,
      roleId: row.role_id,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      documentType: row.document_type,
      documentNumber: row.document_number,
      phone: row.phone,
      email: row.email,
      position: row.position,
      status: row.status,
      hireDate: row.hire_date,
      notes: row.notes,
      payRate: row.pay_rate ? parseFloat(row.pay_rate) : null,
      payFrequency: row.pay_frequency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static shiftToDomain(row: EmployeeShiftRow): EmployeeShift {
    return {
      id: row.id,
      employeeId: row.employee_id,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      branchId: row.branch_id,
    };
  }
}
