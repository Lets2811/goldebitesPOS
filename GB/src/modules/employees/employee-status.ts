import type { StatusTone } from '../../components/common/StatusChip';
import type {
  CredentialsStatus,
  EmployeeDocumentType,
  EmployeePayFrequency,
  EmployeeStatus,
} from './types/employee.types';

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  ON_VACATION: 'Vacaciones',
  ON_LEAVE: 'Incapacidad',
};

export const EMPLOYEE_DOCUMENT_TYPE_LABELS: Record<EmployeeDocumentType, string> = {
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  TI: 'Tarjeta de identidad',
  PPT: 'Permiso por protección temporal',
  PASSPORT: 'Pasaporte',
  NIT: 'NIT',
  OTHER: 'Otro',
};

/** Short form for tables: "CC 1020304050". */
export const EMPLOYEE_DOCUMENT_TYPE_SHORT: Record<EmployeeDocumentType, string> = {
  CC: 'CC',
  CE: 'CE',
  TI: 'TI',
  PPT: 'PPT',
  PASSPORT: 'Pas.',
  NIT: 'NIT',
  OTHER: 'Doc.',
};

export const EMPLOYEE_STATUS_TONE: Record<EmployeeStatus, StatusTone> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  ON_VACATION: 'info',
  ON_LEAVE: 'warning',
};

export const CREDENTIALS_STATUS_LABELS: Record<CredentialsStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  BLOCKED: 'Bloqueado',
};

export const CREDENTIALS_STATUS_TONE: Record<CredentialsStatus, StatusTone> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  BLOCKED: 'error',
};

/** day_of_week: 0 = Sunday, matching Postgres EXTRACT(DOW). */
export const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Same order as WEEKDAY_LABELS. */
export const WEEKDAY_FULL_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const EMPLOYEE_PAY_FREQUENCY_LABELS: Record<EmployeePayFrequency, string> = {
  SHIFT: 'Por turno',
  WEEK: 'Semanal',
  BIWEEKLY: 'Quincenal',
  MONTH: 'Mensual',
};
