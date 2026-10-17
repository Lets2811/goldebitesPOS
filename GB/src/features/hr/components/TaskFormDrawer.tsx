import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { Trash2 } from 'lucide-react';
import FormDrawer from '../../../components/common/FormDrawer';
import { HR_TASK_PRIORITY_LABELS, HR_TASK_STATUS_LABELS } from '../../../modules/hr/hr-labels';
import type { HrTask } from '../../../modules/hr/types/hr.types';

const taskSchema = z.object({
  title: z.string().trim().min(1, 'Escribe un título').max(150),
  description: z.string().max(4000),
  assigneeEmployeeId: z.string(),
  branchId: z.string(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
  dueDate: z.string(),
});

export type TaskFormValues = z.infer<typeof taskSchema>;

const emptyValues: TaskFormValues = {
  title: '',
  description: '',
  assigneeEmployeeId: '',
  branchId: '',
  priority: 'MEDIUM',
  status: 'TODO',
  dueDate: '',
};

interface TaskFormDrawerProps {
  open: boolean;
  task: HrTask | null;
  employees: { id: string; firstName: string; lastName: string }[];
  branches: { id: string; name: string }[];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => void;
  onDelete?: (task: HrTask) => void;
}

export default function TaskFormDrawer({
  open,
  task,
  employees,
  branches,
  loading,
  onClose,
  onSubmit,
  onDelete,
}: TaskFormDrawerProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskFormValues>({ resolver: zodResolver(taskSchema), defaultValues: emptyValues });

  useEffect(() => {
    if (!open) return;
    reset(
      task
        ? {
            title: task.title,
            description: task.description ?? '',
            assigneeEmployeeId: task.assignee?.id ?? '',
            branchId: task.branchId ?? '',
            priority: task.priority,
            status: task.status,
            dueDate: task.dueDate ?? '',
          }
        : emptyValues,
    );
  }, [open, task, reset]);

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      title={task ? 'Editar tarea' : 'Nueva tarea'}
      submitLabel={task ? 'Guardar cambios' : 'Crear tarea'}
      loading={loading}
      width={460}
    >
      <Stack spacing={2.5}>
        <Controller
          name="title"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Título"
              autoFocus={!task}
              fullWidth
              error={Boolean(errors.title)}
              helperText={errors.title?.message}
            />
          )}
        />
        <Controller
          name="description"
          control={control}
          render={({ field }) => <TextField {...field} label="Descripción" multiline minRows={3} fullWidth />}
        />
        <Controller
          name="assigneeEmployeeId"
          control={control}
          render={({ field }) => (
            <TextField {...field} select label="Responsable" fullWidth slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
              <MenuItem value="">Sin asignar</MenuItem>
              {employees.map((employee) => (
                <MenuItem key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
        <Stack direction="row" spacing={2}>
          <Controller
            name="dueDate"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Fecha de entrega"
                type="date"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}
          />
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <TextField {...field} select label="Prioridad" fullWidth>
                {Object.entries(HR_TASK_PRIORITY_LABELS).map(([value, label]) => (
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
            name="status"
            control={control}
            render={({ field }) => (
              <TextField {...field} select label="Estado" fullWidth>
                {Object.entries(HR_TASK_STATUS_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
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
                <TextField {...field} select label="Sede" fullWidth slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                  <MenuItem value="">Todas</MenuItem>
                  {branches.map((branch) => (
                    <MenuItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          )}
        </Stack>
        {task && onDelete && (
          <Button
            color="error"
            startIcon={<Trash2 size={16} />}
            onClick={() => onDelete(task)}
            sx={{ alignSelf: 'flex-start' }}
          >
            Eliminar tarea
          </Button>
        )}
      </Stack>
    </FormDrawer>
  );
}
