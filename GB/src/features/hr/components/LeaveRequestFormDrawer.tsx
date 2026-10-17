import { useEffect } from 'react';
import dayjs from 'dayjs';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import FormDrawer from '../../../components/common/FormDrawer';
import { LEAVE_TYPE_LABELS } from '../../../modules/hr/hr-labels';
import type { LeaveRequestInput } from '../../../modules/hr/types/hr.types';

const leaveSchema = z
  .object({
    employeeId: z.string(),
    type: z.enum(['PERMISSION', 'VACATION', 'SICK', 'DAY_OFF', 'OTHER']),
    startDate: z.string().min(1, 'Elige el primer día'),
    endDate: z.string().min(1, 'Elige el último día'),
    reason: z.string().max(1000),
  })
  .refine((values) => !values.startDate || !values.endDate || values.endDate >= values.startDate, {
    message: 'Debe ser igual o posterior al primer día',
    path: ['endDate'],
  });

type LeaveFormValues = z.infer<typeof leaveSchema>;

interface LeaveRequestFormDrawerProps {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: LeaveRequestInput & { employeeId?: string }) => void;
  /** Con la lista, el administrador elige para quién es; sin ella, es para quien lo pide. */
  employees?: { id: string; firstName: string; lastName: string }[];
}

/** Pedir (o, para un administrador, registrar) días de permiso, vacaciones, incapacidad o descanso. */
export default function LeaveRequestFormDrawer({
  open,
  loading,
  onClose,
  onSubmit,
  employees,
}: LeaveRequestFormDrawerProps) {
  const forEmployee = Boolean(employees);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<LeaveFormValues>({ resolver: zodResolver(leaveSchema) });

  useEffect(() => {
    if (!open) return;
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
    reset({ employeeId: '', type: 'PERMISSION', startDate: tomorrow, endDate: tomorrow, reason: '' });
  }, [open, reset]);

  const submit = handleSubmit((values) => {
    if (forEmployee && !values.employeeId) {
      setError('employeeId', { message: 'Elige el empleado' });
      return;
    }
    onSubmit({
      employeeId: forEmployee ? values.employeeId : undefined,
      type: values.type,
      startDate: values.startDate,
      endDate: values.endDate,
      reason: values.reason.trim() || undefined,
    });
  });

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={forEmployee ? 'Registrar permiso' : 'Solicitar permiso'}
      subtitle={
        forEmployee
          ? 'Queda aprobado de una vez y se descuenta del turno efectivo.'
          : 'Tu administrador lo revisa y te responde aquí mismo.'
      }
      submitLabel={forEmployee ? 'Registrar' : 'Enviar solicitud'}
      loading={loading}
      width={440}
    >
      <Stack spacing={2.5}>
        {forEmployee && (
          <Controller
            name="employeeId"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                select
                label="Empleado"
                fullWidth
                error={Boolean(errors.employeeId)}
                helperText={errors.employeeId?.message}
              >
                {(employees ?? []).map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        )}
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <TextField {...field} value={field.value ?? 'PERMISSION'} select label="Tipo" fullWidth>
              {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
        <Stack direction="row" spacing={2}>
          <Controller
            name="startDate"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                type="date"
                label="Desde"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                error={Boolean(errors.startDate)}
                helperText={errors.startDate?.message}
              />
            )}
          />
          <Controller
            name="endDate"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                type="date"
                label="Hasta (incluido)"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                error={Boolean(errors.endDate)}
                helperText={errors.endDate?.message}
              />
            )}
          />
        </Stack>
        <Controller
          name="reason"
          control={control}
          render={({ field }) => (
            <TextField {...field} value={field.value ?? ''} label="Motivo (opcional)" multiline minRows={3} fullWidth />
          )}
        />
      </Stack>
    </FormDrawer>
  );
}
