import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Banknote, BookOpen, Clock } from 'lucide-react';
import { useSnackbar } from 'notistack';
import PageHeader from '../../../components/common/PageHeader';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import ErrorState from '../../../components/common/ErrorState';
import EmptyState from '../../../components/common/EmptyState';
import CurrencyDisplay from '../../../components/common/CurrencyDisplay';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useBranches } from '../../../modules/branches/hooks/use-branches';
import { getRoleLabel } from '../../../modules/roles/role-labels';
import { useMyHrProfile } from '../../../modules/hr/hooks/use-my-hr-profile';
import { useMyShifts } from '../../../modules/employees/hooks/use-my-shifts';
import { useReplaceMyShifts } from '../../../modules/employees/hooks/use-replace-my-shifts';
import { useMyPayroll } from '../../../modules/employees/hooks/use-my-payroll';
import { useUpdateMyPayFrequency } from '../../../modules/employees/hooks/use-update-my-pay-frequency';
import { normalizeApiError } from '../../../lib/api/api-error';
import { EMPLOYEE_PAY_FREQUENCY_LABELS } from '../../../modules/employees/employee-status';
import type {
  EmployeePayFrequency,
  ShiftInput,
} from '../../../modules/employees/types/employee.types';
import { SELF_SERVICE_PAY_FREQUENCIES } from '../../../modules/employees/types/employee.types';
import WeeklyScheduleEditor from '../../employees/components/WeeklyScheduleEditor';
import MyLeaveCard from '../components/MyLeaveCard';
import MyTasksCard from '../components/MyTasksCard';

export default function MyProfilePage() {
  const branchId = useAuthStore((s) => s.user?.branchId);
  const { enqueueSnackbar } = useSnackbar();
  const { data: profile, isLoading, isError, refetch } = useMyHrProfile();
  const { data: branchPage } = useBranches({ isActive: true, limit: 50 });
  const { data: myShifts, isLoading: shiftsLoading } = useMyShifts();
  const replaceMyShifts = useReplaceMyShifts();
  const { data: myPayroll, isLoading: payrollLoading } = useMyPayroll();
  const updatePayFrequency = useUpdateMyPayFrequency();

  const handleSaveShifts = (shifts: ShiftInput[]) => {
    replaceMyShifts.mutate(shifts, {
      onSuccess: () => enqueueSnackbar('Horario actualizado correctamente', { variant: 'success' }),
      onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
    });
  };

  const handlePayFrequencyChange = (payFrequency: EmployeePayFrequency) => {
    updatePayFrequency.mutate(payFrequency, {
      onSuccess: () => enqueueSnackbar('Periodicidad de pago actualizada', { variant: 'success' }),
      onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
    });
  };

  return (
    <>
      <PageHeader title="Mi Perfil" subtitle="Tu rol, tus tareas, tus permisos y las normas de tu sede." breadcrumbs={[{ label: 'Mi Perfil' }]} />

      {isLoading && <LoadingSkeleton variant="page" />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {profile && (
        <Stack spacing={3}>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <BookOpen size={20} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Mi rol
                  </Typography>
                  <Chip label={getRoleLabel(profile.role.name)} size="small" color="primary" />
                </Stack>
                {profile.role.description ? (
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                    {profile.role.description}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Tu administrador aún no configuró una descripción para este rol.
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Tareas y permisos son de empleados: una cuenta sin ficha de empleado (el dueño, por ejemplo) no los tiene. */}
          {myShifts !== null && myShifts !== undefined && (
            <>
              <MyTasksCard />
              <MyLeaveCard />
            </>
          )}

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Normas de mi sede
                </Typography>

                {!branchId && (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No tienes una sede asignada.
                  </Typography>
                )}

                {branchId && profile.branchRules.length === 0 && (
                  <Box sx={{ py: 1 }}>
                    <EmptyState title="Sin normas configuradas" description="Tu sede aún no tiene normas registradas." />
                  </Box>
                )}

                {branchId && profile.branchRules.length > 0 && (
                  <Stack spacing={2} divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
                    {profile.branchRules.map((rule) => (
                      <Box key={rule.id}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {rule.title}
                        </Typography>
                        {rule.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>
                            {rule.description}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Clock size={20} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Mi horario
                  </Typography>
                </Stack>

                {shiftsLoading && <LoadingSkeleton variant="list" />}

                {!shiftsLoading && myShifts === null && (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No tienes un horario configurado.
                  </Typography>
                )}

                {!shiftsLoading && myShifts !== null && myShifts !== undefined && (
                  <WeeklyScheduleEditor
                    resetKey="me"
                    shifts={myShifts}
                    onSave={handleSaveShifts}
                    saving={replaceMyShifts.isPending}
                    branches={branchPage?.data ?? []}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Banknote size={20} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Nómina
                  </Typography>
                </Stack>

                {payrollLoading && <LoadingSkeleton variant="list" />}

                {!payrollLoading && myPayroll === null && (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No tienes información de nómina configurada.
                  </Typography>
                )}

                {!payrollLoading && myPayroll && (
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Valor
                      </Typography>
                      {myPayroll.payRate != null ? (
                        <CurrencyDisplay value={myPayroll.payRate} variant="h6" sx={{ fontWeight: 700 }} />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Sin definir
                        </Typography>
                      )}
                    </Box>
                    <TextField
                      select
                      label="Periodicidad de pago"
                      value={myPayroll.payFrequency ?? ''}
                      onChange={(e) => handlePayFrequencyChange(e.target.value as EmployeePayFrequency)}
                      disabled={updatePayFrequency.isPending}
                      helperText="Puedes elegir cómo prefieres que se calcule tu pago."
                      sx={{ maxWidth: 280 }}
                    >
                      <MenuItem value="" disabled>
                        Selecciona una periodicidad
                      </MenuItem>
                      {SELF_SERVICE_PAY_FREQUENCIES.map((frequency) => (
                        <MenuItem key={frequency} value={frequency}>
                          {EMPLOYEE_PAY_FREQUENCY_LABELS[frequency]}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      )}
    </>
  );
}
