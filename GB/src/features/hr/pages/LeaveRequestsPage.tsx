import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { Check, Plus, X } from 'lucide-react';
import { useSnackbar } from 'notistack';
import HrSectionHeader from '../components/HrSectionHeader';
import LeaveRequestFormDrawer from '../components/LeaveRequestFormDrawer';
import EmptyState from '../../../components/common/EmptyState';
import ErrorState from '../../../components/common/ErrorState';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import StatusChip from '../../../components/common/StatusChip';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useEmployees } from '../../../modules/employees/hooks/use-employees';
import {
  useCreateEmployeeLeave,
  useLeaveRequests,
  useReviewLeaveRequest,
} from '../../../modules/hr/hooks/use-leave-requests';
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_TONE, LEAVE_TYPE_LABELS } from '../../../modules/hr/hr-labels';
import { formatLeaveDates, leaveDayCount } from '../../../modules/hr/leave-format';
import type { LeaveRequest } from '../../../modules/hr/types/hr.types';

type Filter = 'PENDING' | 'ALL';

/** Solicitudes de permiso del personal: se aprueban o rechazan aquí, y un administrador puede registrar una directamente. */
export default function LeaveRequestsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [filter, setFilter] = useState<Filter>('PENDING');
  const { data: requests, isLoading, isError, refetch } = useLeaveRequests(filter === 'PENDING' ? 'PENDING' : undefined);
  const { data: employeePage } = useEmployees({ limit: 100 });
  const review = useReviewLeaveRequest();
  const createLeave = useCreateEmployeeLeave();

  const [formOpen, setFormOpen] = useState(false);
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null);
  const [note, setNote] = useState('');

  const employees = useMemo(
    () => (employeePage?.data ?? []).filter((employee) => employee.status !== 'INACTIVE'),
    [employeePage],
  );

  const onError = (error: unknown) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' });

  const answer = (request: LeaveRequest, decision: 'APPROVED' | 'REJECTED', reviewNote?: string) =>
    review.mutate(
      { id: request.id, decision, note: reviewNote },
      {
        onSuccess: () => {
          enqueueSnackbar(decision === 'APPROVED' ? 'Solicitud aprobada' : 'Solicitud rechazada', { variant: 'success' });
          setRejecting(null);
        },
        onError,
      },
    );

  return (
    <>
      <HrSectionHeader
        description="Los permisos que pide el personal desde su perfil. Los aprobados se descuentan del turno efectivo."
        actions={
          <Button variant="outlined" startIcon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
            Registrar permiso
          </Button>
        }
      />

      <ToggleButtonGroup
        exclusive
        size="small"
        value={filter}
        onChange={(_, value: Filter | null) => value && setFilter(value)}
        sx={{ mb: 2.5 }}
      >
        <ToggleButton value="PENDING">Pendientes</ToggleButton>
        <ToggleButton value="ALL">Todas</ToggleButton>
      </ToggleButtonGroup>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <LoadingSkeleton variant="list" />
      ) : (requests ?? []).length === 0 ? (
        <EmptyState
          title={filter === 'PENDING' ? 'No hay solicitudes por responder' : 'Aún no hay solicitudes'}
          description="Cuando alguien pida un permiso desde su perfil, aparece aquí."
        />
      ) : (
        <Card variant="outlined">
          {(requests ?? []).map((request, index) => {
            const days = leaveDayCount(request.startDate, request.endDate);
            return (
              <Stack
                key={request.id}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{
                  px: 2,
                  py: 1.75,
                  alignItems: { sm: 'center' },
                  borderTop: index === 0 ? 'none' : '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {request.employee.firstName} {request.employee.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      · {LEAVE_TYPE_LABELS[request.type]}
                    </Typography>
                  </Stack>
                  <Typography variant="body2">
                    {formatLeaveDates(request.startDate, request.endDate)}{' '}
                    <Typography component="span" variant="body2" color="text.secondary">
                      ({days} día{days === 1 ? '' : 's'})
                    </Typography>
                  </Typography>
                  {request.reason && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                      “{request.reason}”
                    </Typography>
                  )}
                  {request.reviewNote && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Respuesta: {request.reviewNote}
                    </Typography>
                  )}
                </Box>
                {request.status === 'PENDING' ? (
                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<X size={15} />}
                      disabled={review.isPending}
                      onClick={() => {
                        setNote('');
                        setRejecting(request);
                      }}
                    >
                      Rechazar
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Check size={15} />}
                      disabled={review.isPending}
                      onClick={() => answer(request, 'APPROVED')}
                    >
                      Aprobar
                    </Button>
                  </Stack>
                ) : (
                  <StatusChip label={LEAVE_STATUS_LABELS[request.status]} tone={LEAVE_STATUS_TONE[request.status]} />
                )}
              </Stack>
            );
          })}
        </Card>
      )}

      <Dialog open={Boolean(rejecting)} onClose={() => setRejecting(null)} fullWidth maxWidth="xs">
        <DialogTitle>Rechazar solicitud</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {rejecting && `${rejecting.employee.firstName} verá tu respuesta en su perfil.`}
          </Typography>
          <TextField
            label="Motivo (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejecting(null)}>Cancelar</Button>
          <Button
            color="error"
            variant="contained"
            loading={review.isPending}
            onClick={() => rejecting && answer(rejecting, 'REJECTED', note.trim() || undefined)}
          >
            Rechazar
          </Button>
        </DialogActions>
      </Dialog>

      <LeaveRequestFormDrawer
        open={formOpen}
        employees={employees}
        loading={createLeave.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={(values) =>
          createLeave.mutate(
            { ...values, employeeId: values.employeeId! },
            {
              onSuccess: () => {
                enqueueSnackbar('Permiso registrado', { variant: 'success' });
                setFormOpen(false);
              },
              onError,
            },
          )
        }
      />
    </>
  );
}
