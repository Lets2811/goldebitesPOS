import type { StatusTone } from '../../components/common/StatusChip';
import type { HrTaskPriority, HrTaskStatus, LeaveRequestStatus, LeaveRequestType } from './types/hr.types';

export const HR_TASK_STATUS_LABELS: Record<HrTaskStatus, string> = {
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  DONE: 'Hecha',
};

export const HR_TASK_PRIORITY_LABELS: Record<HrTaskPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
};

export const HR_TASK_PRIORITY_TONE: Record<HrTaskPriority, StatusTone> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'error',
};

export const LEAVE_TYPE_LABELS: Record<LeaveRequestType, string> = {
  PERMISSION: 'Permiso',
  VACATION: 'Vacaciones',
  SICK: 'Incapacidad',
  DAY_OFF: 'Día libre',
  OTHER: 'Otro',
};

export const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

export const LEAVE_STATUS_TONE: Record<LeaveRequestStatus, StatusTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'neutral',
};
