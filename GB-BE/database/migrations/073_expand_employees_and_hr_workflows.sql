-- Migration: 073_expand_employees_and_hr_workflows.sql
-- Created: 2026-10-14

-- Identity document of an employee. The number is unique within a business
-- (among employees not deleted), so the same person can't be registered twice.
ALTER TABLE employees
  ADD COLUMN document_type VARCHAR(10),
  ADD COLUMN document_number VARCHAR(30),
  ADD CONSTRAINT employees_document_type_check
    CHECK (document_type IS NULL OR document_type IN ('CC', 'CE', 'TI', 'PPT', 'PASSPORT', 'NIT', 'OTHER'));

CREATE UNIQUE INDEX idx_employees_business_document
  ON employees (business_id, document_number)
  WHERE deleted_at IS NULL AND document_number IS NOT NULL;

-- The branch where each weekly shift is worked. Null keeps the old meaning:
-- the employee's own branch.
ALTER TABLE employee_shifts ADD COLUMN branch_id UUID REFERENCES branches (id);

-- Team task board. A task is assigned to an employee (not a login account),
-- so it works for staff without access to the system too.
CREATE TABLE hr_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id),
  branch_id UUID REFERENCES branches (id),
  title VARCHAR(150) NOT NULL,
  description TEXT,
  assignee_employee_id UUID REFERENCES employees (id),
  status VARCHAR(20) NOT NULL DEFAULT 'TODO',
  priority VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT hr_tasks_status_check CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
  CONSTRAINT hr_tasks_priority_check CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH'))
);

CREATE INDEX idx_hr_tasks_business ON hr_tasks (business_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_hr_tasks_assignee ON hr_tasks (assignee_employee_id) WHERE deleted_at IS NULL;

CREATE TRIGGER update_hr_tasks_updated_at
BEFORE UPDATE ON hr_tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Time-off requests: an employee asks from their profile, an administrator
-- approves or rejects. Approved ones take those days off the effective
-- schedule.
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id),
  employee_id UUID NOT NULL REFERENCES employees (id),
  type VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  requested_by_user_id UUID REFERENCES users (id),
  reviewed_by_user_id UUID REFERENCES users (id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leave_requests_type_check
    CHECK (type IN ('PERMISSION', 'VACATION', 'SICK', 'DAY_OFF', 'OTHER')),
  CONSTRAINT leave_requests_status_check
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  CONSTRAINT leave_requests_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX idx_leave_requests_business_status ON leave_requests (business_id, status);
CREATE INDEX idx_leave_requests_employee_dates ON leave_requests (employee_id, start_date, end_date);

CREATE TRIGGER update_leave_requests_updated_at
BEFORE UPDATE ON leave_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
