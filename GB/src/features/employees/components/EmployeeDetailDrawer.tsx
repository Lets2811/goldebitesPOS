import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import { Phone, Mail, Calendar, Pencil, Trash2, Receipt, IdCard } from 'lucide-react';
import { useSnackbar } from 'notistack';
import DetailDrawer from '../../../components/common/DetailDrawer';
import StatusChip from '../../../components/common/StatusChip';
import DateDisplay from '../../../components/common/DateDisplay';
import CurrencyDisplay from '../../../components/common/CurrencyDisplay';
import { Can } from '../../../modules/auth/components/can';
import { useBranches } from '../../../modules/branches/hooks/use-branches';
import { useEmployee } from '../../../modules/employees/hooks/use-employee';
import { useSetEmployeeShifts } from '../../../modules/employees/hooks/use-set-employee-shifts';
import { usePrintPaymentReceipt } from '../../../modules/employees/hooks/use-print-payment-receipt';
import { useRoles } from '../../../modules/roles/hooks/use-roles';
import { getRoleLabel } from '../../../modules/roles/role-labels';
import { normalizeApiError } from '../../../lib/api/api-error';
import {
  EMPLOYEE_DOCUMENT_TYPE_LABELS,
  EMPLOYEE_PAY_FREQUENCY_LABELS,
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUS_TONE,
} from '../../../modules/employees/employee-status';
import type { Employee, ShiftInput } from '../../../modules/employees/types/employee.types';
import EmployeeCredentialsSection from './EmployeeCredentialsSection';
import WeeklyScheduleEditor from './WeeklyScheduleEditor';

interface EmployeeDetailDrawerProps {
  employeeId: string | null;
  onClose: () => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

export default function EmployeeDetailDrawer({
  employeeId,
  onClose,
  onEdit,
  onDelete,
}: EmployeeDetailDrawerProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { data: employee } = useEmployee(employeeId);
  const { data: roles } = useRoles();
  const { data: branchPage } = useBranches({ isActive: true, limit: 50 });
  const roleLabel = roles?.find((role) => role.id === employee?.roleId)?.name;
  const setShifts = useSetEmployeeShifts();
  const printReceipt = usePrintPaymentReceipt();

  if (!employeeId || !employee) return null;

  const fullName = `${employee.firstName} ${employee.lastName}`;

  const handleSaveShifts = (shifts: ShiftInput[]) => {
    setShifts.mutate(
      { id: employee.id, shifts },
      {
        onSuccess: () => enqueueSnackbar('Horario actualizado correctamente', { variant: 'success' }),
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );
  };

  return (
    <DetailDrawer
      open={Boolean(employeeId)}
      onClose={onClose}
      title={fullName}
      subtitle={roleLabel ? getRoleLabel(roleLabel) : undefined}
      headerExtra={
        <StatusChip label={EMPLOYEE_STATUS_LABELS[employee.status]} tone={EMPLOYEE_STATUS_TONE[employee.status]} />
      }
      footer={
        <Can permission="employees.manage">
          <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
            <Button color="error" startIcon={<Trash2 size={16} />} onClick={() => onDelete(employee)}>
              Eliminar
            </Button>
            <Button variant="contained" startIcon={<Pencil size={16} />} onClick={() => onEdit(employee)}>
              Editar
            </Button>
          </Stack>
        </Can>
      }
    >
      <Stack spacing={3}>
        <Stack spacing={1}>
          {employee.documentNumber && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
              <IdCard size={14} />
              <Typography variant="body2">
                {employee.documentType ? `${EMPLOYEE_DOCUMENT_TYPE_LABELS[employee.documentType]} ` : ''}
                {employee.documentNumber}
              </Typography>
            </Stack>
          )}
          {employee.phone && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
              <Phone size={14} />
              <Typography variant="body2">{employee.phone}</Typography>
            </Stack>
          )}
          {employee.email && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
              <Mail size={14} />
              <Typography variant="body2">{employee.email}</Typography>
            </Stack>
          )}
          {employee.hireDate && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
              <Calendar size={14} />
              <Typography variant="body2" component="span">
                Ingreso: <DateDisplay value={employee.hireDate} component="span" variant="body2" sx={{ fontWeight: 600 }} />
              </Typography>
            </Stack>
          )}
        </Stack>

        <Divider />

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Pago
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mb: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Valor
              </Typography>
              {employee.payRate != null ? (
                <CurrencyDisplay value={employee.payRate} variant="h6" sx={{ fontWeight: 700 }} />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Sin definir
                </Typography>
              )}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Frecuencia
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {employee.payFrequency ? EMPLOYEE_PAY_FREQUENCY_LABELS[employee.payFrequency] : 'Sin definir'}
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Receipt size={15} />}
            disabled={employee.payRate == null}
            onClick={() => printReceipt(employee)}
          >
            Generar comprobante de pago
          </Button>
        </Box>

        <Divider />

        <EmployeeCredentialsSection employee={employee} />

        <Divider />

        <Can permission="employees.manage">
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Horario semanal
            </Typography>
            <WeeklyScheduleEditor
              resetKey={employee.id}
              shifts={employee.shifts}
              onSave={handleSaveShifts}
              saving={setShifts.isPending}
              branches={branchPage?.data ?? []}
            />
          </Box>
        </Can>

        {employee.notes && (
          <>
            <Divider />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Observaciones
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {employee.notes}
              </Typography>
            </Box>
          </>
        )}
      </Stack>
    </DetailDrawer>
  );
}
