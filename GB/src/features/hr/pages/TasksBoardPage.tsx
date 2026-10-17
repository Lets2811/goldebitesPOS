import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { CalendarDays, Plus, User } from 'lucide-react';
import { useSnackbar } from 'notistack';
import HrSectionHeader from '../components/HrSectionHeader';
import TaskFormDrawer, { type TaskFormValues } from '../components/TaskFormDrawer';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import ErrorState from '../../../components/common/ErrorState';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import SearchInput from '../../../components/common/SearchInput';
import StatusChip from '../../../components/common/StatusChip';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useBranches } from '../../../modules/branches/hooks/use-branches';
import { useEmployees } from '../../../modules/employees/hooks/use-employees';
import {
  useCreateHrTask,
  useDeleteHrTask,
  useHrTasks,
  useUpdateHrTask,
} from '../../../modules/hr/hooks/use-hr-tasks';
import { HR_TASK_PRIORITY_LABELS, HR_TASK_PRIORITY_TONE, HR_TASK_STATUS_LABELS } from '../../../modules/hr/hr-labels';
import type { HrTask, HrTaskStatus } from '../../../modules/hr/types/hr.types';
import { brand } from '../../../theme/palette';

const COLUMNS: HrTaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

/** "Vence hoy", "Venció hace 2 días", "Vence el 20 oct". Null si no tiene fecha. */
function dueLabel(task: HrTask): { text: string; overdue: boolean } | null {
  if (!task.dueDate) return null;
  const days = dayjs(task.dueDate).startOf('day').diff(dayjs().startOf('day'), 'day');
  const date = dayjs(task.dueDate).toDate().toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  if (task.status === 'DONE') return { text: `Entrega ${date}`, overdue: false };
  if (days === 0) return { text: 'Vence hoy', overdue: false };
  if (days === 1) return { text: 'Vence mañana', overdue: false };
  if (days < 0) return { text: `Venció hace ${-days} día${days === -1 ? '' : 's'}`, overdue: true };
  return { text: `Vence el ${date}`, overdue: false };
}

function TaskCard({
  task,
  onOpen,
  onToggleDone,
}: {
  task: HrTask;
  onOpen: () => void;
  onToggleDone: (done: boolean) => void;
}) {
  const due = dueLabel(task);
  const done = task.status === 'DONE';
  return (
    <Card
      variant="outlined"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onOpen}
      sx={{
        p: 1.25,
        cursor: 'grab',
        '&:active': { cursor: 'grabbing' },
        '&:hover': { borderColor: alpha(brand.gold, 0.6) },
        opacity: done ? 0.75 : 1,
      }}
    >
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-start' }}>
        <Checkbox
          size="small"
          checked={done}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onToggleDone(e.target.checked)}
          slotProps={{ input: { 'aria-label': done ? 'Marcar como pendiente' : 'Marcar como hecha' } }}
          sx={{ p: 0.25, mt: -0.25 }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, textDecoration: done ? 'line-through' : 'none', overflowWrap: 'anywhere' }}
          >
            {task.title}
          </Typography>
          {task.description && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {task.description}
            </Typography>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center', flexWrap: 'wrap', rowGap: 0.75 }}>
            {task.priority !== 'MEDIUM' && (
              <StatusChip label={HR_TASK_PRIORITY_LABELS[task.priority]} tone={HR_TASK_PRIORITY_TONE[task.priority]} />
            )}
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', color: 'text.secondary' }}>
              <User size={12} />
              <Typography variant="caption">
                {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : 'Sin asignar'}
              </Typography>
            </Stack>
            {due && (
              <Stack
                direction="row"
                spacing={0.5}
                sx={{ alignItems: 'center', color: due.overdue ? 'error.main' : 'text.secondary' }}
              >
                <CalendarDays size={12} />
                <Typography variant="caption" sx={{ fontWeight: due.overdue ? 700 : 400 }}>
                  {due.text}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Box>
      </Stack>
    </Card>
  );
}

/** El tablero de tareas del equipo: por hacer, en progreso y hechas. Se arrastran entre columnas o se marcan con la casilla. */
export default function TasksBoardPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { data: tasks, isLoading, isError, refetch } = useHrTasks();
  const { data: employeePage } = useEmployees({ limit: 100 });
  const { data: branchPage } = useBranches({ isActive: true, limit: 50 });
  const createTask = useCreateHrTask();
  const updateTask = useUpdateHrTask();
  const deleteTask = useDeleteHrTask();

  const [search, setSearch] = useState('');
  const [assignee, setAssignee] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HrTask | null>(null);
  const [deleting, setDeleting] = useState<HrTask | null>(null);
  const [dropTarget, setDropTarget] = useState<HrTaskStatus | null>(null);

  const employees = useMemo(
    () => (employeePage?.data ?? []).filter((employee) => employee.status !== 'INACTIVE'),
    [employeePage],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (tasks ?? []).filter(
      (task) =>
        (!assignee || (assignee === 'none' ? !task.assignee : task.assignee?.id === assignee)) &&
        (!term ||
          task.title.toLowerCase().includes(term) ||
          (task.description ?? '').toLowerCase().includes(term)),
    );
  }, [tasks, search, assignee]);

  const onError = (error: unknown) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' });

  const moveTask = (task: HrTask, status: HrTaskStatus) => {
    if (task.status === status) return;
    updateTask.mutate({ id: task.id, payload: { status } }, { onError });
  };

  const handleSubmit = (values: TaskFormValues) => {
    const payload = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      assigneeEmployeeId: values.assigneeEmployeeId || null,
      branchId: values.branchId || null,
      priority: values.priority,
      status: values.status,
      dueDate: values.dueDate || null,
    };
    const onSuccess = () => {
      enqueueSnackbar(editing ? 'Tarea actualizada' : 'Tarea creada', { variant: 'success' });
      setFormOpen(false);
    };
    if (editing) updateTask.mutate({ id: editing.id, payload }, { onSuccess, onError });
    else createTask.mutate(payload, { onSuccess, onError });
  };

  return (
    <>
      <HrSectionHeader
        description="Asigna tareas al equipo, con responsable y fecha de entrega. Cada empleado ve las suyas en su perfil y puede marcarlas como hechas."
        actions={
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Nueva tarea
          </Button>
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <Box sx={{ flex: 1, maxWidth: 360 }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar tarea..." />
        </Box>
        <TextField
          select
          size="small"
          label="Responsable"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="none">Sin asignar</MenuItem>
          {employees.map((employee) => (
            <MenuItem key={employee.id} value={employee.id}>
              {employee.firstName} {employee.lastName}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <LoadingSkeleton variant="list" />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, alignItems: 'start' }}>
          {COLUMNS.map((status) => {
            const columnTasks = visible.filter((task) => task.status === status);
            return (
              <Box
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropTarget(status);
                }}
                onDragLeave={() => setDropTarget((current) => (current === status ? null : current))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropTarget(null);
                  const task = tasks?.find((t) => t.id === e.dataTransfer.getData('text/plain'));
                  if (task) moveTask(task, status);
                }}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  minHeight: 160,
                  border: '1px dashed',
                  borderColor: dropTarget === status ? brand.gold : 'divider',
                  backgroundColor: dropTarget === status ? alpha(brand.gold, 0.08) : (theme) => alpha(theme.palette.text.primary, 0.02),
                  transition: 'background-color 120ms, border-color 120ms',
                }}
              >
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {HR_TASK_STATUS_LABELS[status]}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {columnTasks.length}
                  </Typography>
                </Stack>
                <Stack spacing={1}>
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onOpen={() => {
                        setEditing(task);
                        setFormOpen(true);
                      }}
                      onToggleDone={(done) => moveTask(task, done ? 'DONE' : 'TODO')}
                    />
                  ))}
                  {columnTasks.length === 0 && (
                    <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center', py: 3 }}>
                      {status === 'DONE' ? 'Nada terminado todavía' : 'Sin tareas'}
                    </Typography>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Box>
      )}

      <TaskFormDrawer
        open={formOpen}
        task={editing}
        employees={employees}
        branches={branchPage?.data ?? []}
        loading={createTask.isPending || updateTask.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        onDelete={(task) => {
          setFormOpen(false);
          setDeleting(task);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar tarea"
        description={`¿Seguro que deseas eliminar "${deleting?.title}"?`}
        confirmLabel="Eliminar"
        destructive
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          deleteTask.mutate(deleting.id, {
            onSuccess: () => enqueueSnackbar('Tarea eliminada', { variant: 'success' }),
            onError,
            onSettled: () => setDeleting(null),
          });
        }}
      />
    </>
  );
}
