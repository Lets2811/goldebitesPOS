import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { CalendarOff, Plus } from 'lucide-react';
import { useSnackbar } from 'notistack';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import StatusChip from '../../../components/common/StatusChip';
import { normalizeApiError } from '../../../lib/api/api-error';
import {
  useCancelMyLeaveRequest,
  useMyLeaveRequests,
  useRequestMyLeave,
} from '../../../modules/hr/hooks/use-leave-requests';
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_TONE, LEAVE_TYPE_LABELS } from '../../../modules/hr/hr-labels';
import { formatLeaveDates } from '../../../modules/hr/leave-format';
import LeaveRequestFormDrawer from './LeaveRequestFormDrawer';

/** Los permisos de quien mira su perfil: pedir uno nuevo, ver la respuesta y retirar los que siguen pendientes. */
export default function MyLeaveCard() {
  const { enqueueSnackbar } = useSnackbar();
  const { data: requests, isLoading } = useMyLeaveRequests();
  const requestLeave = useRequestMyLeave();
  const cancel = useCancelMyLeaveRequest();
  const [formOpen, setFormOpen] = useState(false);

  const onError = (error: unknown) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' });

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <CalendarOff size={20} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
              Mis permisos
            </Typography>
            <Button size="small" variant="outlined" startIcon={<Plus size={15} />} onClick={() => setFormOpen(true)}>
              Solicitar permiso
            </Button>
          </Stack>

          {isLoading && <LoadingSkeleton variant="list" />}

          {!isLoading && (requests ?? []).length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No has pedido permisos.
            </Typography>
          )}

          {(requests ?? []).slice(0, 8).map((request) => (
            <Stack key={request.id} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {LEAVE_TYPE_LABELS[request.type]} · {formatLeaveDates(request.startDate, request.endDate)}
                </Typography>
                {request.reviewNote && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Respuesta: {request.reviewNote}
                  </Typography>
                )}
              </Box>
              {request.status === 'PENDING' && (
                <Button
                  size="small"
                  color="inherit"
                  disabled={cancel.isPending}
                  onClick={() =>
                    cancel.mutate(request.id, {
                      onSuccess: () => enqueueSnackbar('Solicitud retirada', { variant: 'success' }),
                      onError,
                    })
                  }
                >
                  Retirar
                </Button>
              )}
              <StatusChip label={LEAVE_STATUS_LABELS[request.status]} tone={LEAVE_STATUS_TONE[request.status]} />
            </Stack>
          ))}
        </Stack>
      </CardContent>

      <LeaveRequestFormDrawer
        open={formOpen}
        loading={requestLeave.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={({ type, startDate, endDate, reason }) =>
          requestLeave.mutate(
            { type, startDate, endDate, reason },
            {
              onSuccess: () => {
                enqueueSnackbar('Solicitud enviada', { variant: 'success' });
                setFormOpen(false);
              },
              onError,
            },
          )
        }
      />
    </Card>
  );
}
