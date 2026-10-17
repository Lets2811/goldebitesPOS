import { useState } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ListTodo } from 'lucide-react';
import { useSnackbar } from 'notistack';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import StatusChip from '../../../components/common/StatusChip';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useMyTasks, useSetMyTaskStatus } from '../../../modules/hr/hooks/use-hr-tasks';
import { HR_TASK_PRIORITY_LABELS, HR_TASK_PRIORITY_TONE, HR_TASK_STATUS_LABELS } from '../../../modules/hr/hr-labels';

/** Las tareas que le asignaron a quien mira su perfil; las marca como hechas aquí mismo. */
export default function MyTasksCard() {
  const { enqueueSnackbar } = useSnackbar();
  const { data: tasks, isLoading } = useMyTasks();
  const setStatus = useSetMyTaskStatus();
  const [showDone, setShowDone] = useState(false);

  const open = (tasks ?? []).filter((task) => task.status !== 'DONE');
  const done = (tasks ?? []).filter((task) => task.status === 'DONE');
  const listed = showDone ? [...open, ...done] : open;
  const today = dayjs().format('YYYY-MM-DD');

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <ListTodo size={20} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
              Mis tareas
            </Typography>
            {done.length > 0 && (
              <Button size="small" onClick={() => setShowDone((value) => !value)}>
                {showDone ? 'Ocultar hechas' : `Ver hechas (${done.length})`}
              </Button>
            )}
          </Stack>

          {isLoading && <LoadingSkeleton variant="list" />}

          {!isLoading && listed.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No tienes tareas pendientes.
            </Typography>
          )}

          {listed.map((task) => {
            const isDone = task.status === 'DONE';
            const overdue = !isDone && task.dueDate !== null && task.dueDate < today;
            return (
              <Stack key={task.id} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Checkbox
                  size="small"
                  checked={isDone}
                  disabled={setStatus.isPending}
                  onChange={(e) =>
                    setStatus.mutate(
                      { id: task.id, status: e.target.checked ? 'DONE' : 'TODO' },
                      { onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }) },
                    )
                  }
                  slotProps={{ input: { 'aria-label': isDone ? 'Marcar como pendiente' : 'Marcar como hecha' } }}
                  sx={{ p: 0.5 }}
                />
                <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, textDecoration: isDone ? 'line-through' : 'none' }}>
                    {task.title}
                  </Typography>
                  {task.description && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                      {task.description}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
                    {task.status === 'IN_PROGRESS' && <StatusChip label={HR_TASK_STATUS_LABELS.IN_PROGRESS} tone="info" />}
                    {task.priority === 'HIGH' && (
                      <StatusChip label={`Prioridad ${HR_TASK_PRIORITY_LABELS.HIGH.toLowerCase()}`} tone={HR_TASK_PRIORITY_TONE.HIGH} />
                    )}
                    {task.dueDate && (
                      <Typography variant="caption" color={overdue ? 'error.main' : 'text.secondary'} sx={{ fontWeight: overdue ? 700 : 400 }}>
                        {overdue ? 'Vencida · ' : 'Entrega: '}
                        {dayjs(task.dueDate).toDate().toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Stack>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
