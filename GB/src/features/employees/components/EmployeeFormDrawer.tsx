import { useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FormDrawer from '../../../components/common/FormDrawer';
import CurrencyField from '../../../components/common/CurrencyField';
import { useBranches } from '../../../modules/branches/hooks/use-branches';
import { useRoles } from '../../../modules/roles/hooks/use-roles';
import { getRoleLabel } from '../../../modules/roles/role-labels';
import {
  EMPLOYEE_DOCUMENT_TYPE_LABELS,
  EMPLOYEE_PAY_FREQUENCY_LABELS,
  EMPLOYEE_STATUS_LABELS,
} from '../../../modules/employees/employee-status';
import { employeeSchema, type EmployeeFormValues } from '../schemas/employeeSchema';
import type { Employee } from '../../../modules/employees/types/employee.types';

interface EmployeeFormDrawerProps {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: EmployeeFormValues) => void;
  initialEmployee?: Employee | null;
}

const emptyValues: EmployeeFormValues = {
  firstName: '',
  lastName: '',
  documentType: 'CC',
  documentNumber: '',
  phone: '',
  email: '',
  roleId: '',
  branchId: '',
  status: 'ACTIVE',
  hireDate: '',
  notes: '',
  payRate: undefined,
  payFrequency: undefined,
  createAccess: true,
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5 }}>
      {children}
    </Typography>
  );
}

export default function EmployeeFormDrawer({
  open,
  loading,
  onClose,
  onSubmit,
  initialEmployee,
}: EmployeeFormDrawerProps) {
  const { data: roles } = useRoles();
  const { data: branchPage } = useBranches({ isActive: true, limit: 50 });
  const branches = branchPage?.data ?? [];
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: emptyValues,
  });
  const createAccess = useWatch({ control, name: 'createAccess' });
  const isCreating = !initialEmployee;

  useEffect(() => {
    if (open) {
      reset(
        initialEmployee
          ? {
              firstName: initialEmployee.firstName,
              lastName: initialEmployee.lastName,
              documentType: initialEmployee.documentType ?? 'CC',
              documentNumber: initialEmployee.documentNumber ?? '',
              phone: initialEmployee.phone ?? '',
              email: initialEmployee.email ?? '',
              roleId: initialEmployee.roleId ?? '',
              branchId: initialEmployee.branchId ?? '',
              status: initialEmployee.status,
              hireDate: initialEmployee.hireDate?.slice(0, 10) ?? '',
              notes: initialEmployee.notes ?? '',
              payRate: initialEmployee.payRate ?? undefined,
              payFrequency: initialEmployee.payFrequency ?? undefined,
              createAccess: false,
            }
          : emptyValues,
      );
    }
  }, [open, initialEmployee, reset]);

  const submit = handleSubmit((values) => onSubmit(values));

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={isCreating ? 'Nuevo empleado' : 'Editar empleado'}
      submitLabel={isCreating ? 'Crear empleado' : 'Guardar cambios'}
      loading={loading ?? isSubmitting}
      width={480}
    >
      <Stack spacing={2.5}>
        <SectionTitle>Datos personales</SectionTitle>
        <Stack direction="row" spacing={2}>
          <Controller
            name="firstName"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nombre"
                fullWidth
                error={Boolean(errors.firstName)}
                helperText={errors.firstName?.message}
              />
            )}
          />
          <Controller
            name="lastName"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Apellido"
                fullWidth
                error={Boolean(errors.lastName)}
                helperText={errors.lastName?.message}
              />
            )}
          />
        </Stack>

        <Stack direction="row" spacing={2}>
          <Controller
            name="documentType"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                select
                label="Tipo de documento"
                sx={{ width: 220, flexShrink: 0 }}
                error={Boolean(errors.documentType)}
                helperText={errors.documentType?.message}
              >
                {Object.entries(EMPLOYEE_DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Controller
            name="documentNumber"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Número de documento"
                fullWidth
                error={Boolean(errors.documentNumber)}
                helperText={errors.documentNumber?.message}
              />
            )}
          />
        </Stack>

        <Stack direction="row" spacing={2}>
          <Controller
            name="phone"
            control={control}
            render={({ field }) => <TextField {...field} label="Teléfono" type="tel" fullWidth />}
          />
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Correo (opcional)"
                type="email"
                fullWidth
                error={Boolean(errors.email)}
                helperText={errors.email?.message}
              />
            )}
          />
        </Stack>

        <Divider />
        <SectionTitle>Trabajo</SectionTitle>

        <Controller
          name="roleId"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              select
              label="Cargo"
              helperText={
                errors.roleId?.message ??
                (isCreating && createAccess ? 'También es el rol de su cuenta de acceso' : undefined)
              }
              error={Boolean(errors.roleId)}
              fullWidth
            >
              {(roles ?? []).map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  {getRoleLabel(role.name)}
                </MenuItem>
              ))}
            </TextField>
          )}
        />

        {branches.length > 1 && (
          <Controller
            name="branchId"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label="Sede principal"
                helperText="Donde trabaja normalmente; cada día del horario puede ser en otra sede."
                fullWidth
                slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
              >
                <MenuItem value="">Sin sede fija</MenuItem>
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        )}

        <Stack direction="row" spacing={2}>
          <Controller
            name="hireDate"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Fecha de ingreso"
                type="date"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}
          />
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <TextField {...field} select label="Estado" fullWidth>
                {Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Stack>

        <Stack direction="row" spacing={2}>
          <Controller
            name="payRate"
            control={control}
            render={({ field }) => (
              <CurrencyField
                {...field}
                value={field.value ?? ''}
                label="Valor"
                fullWidth
                error={Boolean(errors.payRate)}
                helperText={errors.payRate?.message}
              />
            )}
          />
          <Controller
            name="payFrequency"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                select
                label="Frecuencia de pago"
                fullWidth
                slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
              >
                <MenuItem value="">Sin definir</MenuItem>
                {Object.entries(EMPLOYEE_PAY_FREQUENCY_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Stack>

        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <TextField {...field} label="Observaciones" multiline minRows={2} fullWidth />
          )}
        />

        {isCreating && (
          <>
            <Divider />
            <Box>
              <Controller
                name="createAccess"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                    }
                    label="Crear acceso al sistema"
                  />
                )}
              />
              <Typography variant="body2" color="text.secondary" sx={{ pl: 5.75 }}>
                {createAccess
                  ? 'Se le crea un usuario para entrar al POS; te mostramos sus datos al guardar.'
                  : 'Queda registrado solo como empleado, sin usuario. Puedes generarle el acceso después desde su ficha.'}
              </Typography>
            </Box>
          </>
        )}
      </Stack>
    </FormDrawer>
  );
}
