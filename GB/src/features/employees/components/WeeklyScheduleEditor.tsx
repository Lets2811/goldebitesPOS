import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { WEEKDAY_FULL_LABELS } from '../../../modules/employees/employee-status';
import type { ShiftInput } from '../../../modules/employees/types/employee.types';

interface DayRow {
  /** Día de descanso: no tiene turno. */
  off: boolean;
  startTime: string;
  endTime: string;
  /** '' es la sede principal del empleado. */
  branchId: string;
}

type ShiftLike = { dayOfWeek: number; startTime: string; endTime: string; branchId?: string | null };

/** Lunes primero, como se lee una semana de trabajo; dayOfWeek sigue siendo 0 = domingo. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function buildInitialRows(shifts: ShiftLike[]): DayRow[] {
  return WEEKDAY_FULL_LABELS.map((_, dayOfWeek) => {
    const existing = shifts.find((s) => s.dayOfWeek === dayOfWeek);
    return existing
      ? {
          off: false,
          startTime: existing.startTime.slice(0, 5),
          endTime: existing.endTime.slice(0, 5),
          branchId: existing.branchId ?? '',
        }
      : { off: true, startTime: '15:00', endTime: '22:00', branchId: '' };
  });
}

/** La sede común de todos los días que se trabajan, o null si no la hay. */
function sharedBranch(rows: DayRow[]): string | null {
  const branchIds = new Set(rows.filter((row) => !row.off).map((row) => row.branchId));
  return branchIds.size <= 1 ? ([...branchIds][0] ?? '') : null;
}

interface WeeklyScheduleEditorProps {
  /** Rows reset from `shifts` whenever this changes — e.g. an employee id, or "me" for the single self-service instance. */
  resetKey: string;
  shifts: ShiftLike[];
  onSave: (shifts: ShiftInput[]) => void;
  saving?: boolean;
  saveLabel?: string;
  /** Las sedes activas del negocio; con más de una, cada día puede ser en una sede distinta. */
  branches?: { id: string; name: string }[];
}

/**
 * El horario semanal: por día, el turno o "descanso", y con varias sedes,
 * dónde se trabaja (la misma para toda la semana o una por día). Lo comparten
 * la ficha del empleado y "Mi horario" del perfil.
 */
export default function WeeklyScheduleEditor({
  resetKey,
  shifts,
  onSave,
  saving,
  saveLabel = 'Guardar horario',
  branches = [],
}: WeeklyScheduleEditorProps) {
  const [rows, setRows] = useState<DayRow[]>(() => buildInitialRows(shifts));
  const [sameBranch, setSameBranch] = useState(() => sharedBranch(buildInitialRows(shifts)) !== null);
  const [sharedBranchId, setSharedBranchId] = useState(() => sharedBranch(buildInitialRows(shifts)) ?? '');
  const [trackedKey, setTrackedKey] = useState(resetKey);

  if (resetKey !== trackedKey) {
    const nextRows = buildInitialRows(shifts);
    setTrackedKey(resetKey);
    setRows(nextRows);
    setSameBranch(sharedBranch(nextRows) !== null);
    setSharedBranchId(sharedBranch(nextRows) ?? '');
  }

  const multiBranch = branches.length > 1;
  const workDays = rows.filter((row) => !row.off).length;

  const updateRow = (dayOfWeek: number, patch: Partial<DayRow>) => {
    setRows((prev) => prev.map((row, i) => (i === dayOfWeek ? { ...row, ...patch } : row)));
  };

  const handleSameBranchChange = (checked: boolean) => {
    setSameBranch(checked);
    // Al desmarcar, cada día arranca con la sede que tenía la semana completa.
    if (!checked) setRows((prev) => prev.map((row) => ({ ...row, branchId: sharedBranchId })));
  };

  const handleSave = () => {
    const nextShifts: ShiftInput[] = rows
      .map((row, dayOfWeek) => ({ ...row, dayOfWeek }))
      .filter((row) => !row.off)
      .map((row) => ({
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime: row.endTime,
        branchId: (multiBranch ? (sameBranch ? sharedBranchId : row.branchId) : '') || null,
      }));
    onSave(nextShifts);
  };

  const branchOptions = [
    <MenuItem key="" value="">
      Su sede principal
    </MenuItem>,
    ...branches.map((branch) => (
      <MenuItem key={branch.id} value={branch.id}>
        {branch.name}
      </MenuItem>
    )),
  ];

  return (
    <Stack spacing={1.5}>
      {multiBranch && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
          <FormControlLabel
            sx={{ m: 0 }}
            control={
              <Checkbox
                size="small"
                checked={sameBranch}
                onChange={(e) => handleSameBranchChange(e.target.checked)}
              />
            }
            label="Misma sede todos los días"
          />
          {sameBranch && (
            <TextField
              select
              size="small"
              label="Sede"
              value={sharedBranchId}
              onChange={(e) => setSharedBranchId(e.target.value)}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
              sx={{ minWidth: 220 }}
            >
              {branchOptions}
            </TextField>
          )}
        </Stack>
      )}

      <Stack spacing={1} sx={{ containerType: 'inline-size', containerName: 'schedule' }}>
        {DAY_ORDER.map((dayOfWeek) => {
          const row = rows[dayOfWeek];
          return (
            <Box
              key={dayOfWeek}
              sx={{
                // En un panel angosto el día y "Descanso" van arriba y el turno debajo; con espacio, todo en una línea.
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gridTemplateAreas: `"day off" "shift shift"`,
                alignItems: 'center',
                columnGap: 1.5,
                rowGap: 0.75,
                px: 1.25,
                py: 0.75,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: row.off ? (theme) => alpha(theme.palette.text.primary, 0.03) : 'transparent',
                '@container schedule (min-width: 680px)': {
                  gridTemplateColumns: '96px 1fr auto',
                  gridTemplateAreas: `"day shift off"`,
                },
              }}
            >
              <Typography variant="body2" sx={{ gridArea: 'day', fontWeight: 600 }}>
                {WEEKDAY_FULL_LABELS[dayOfWeek]}
              </Typography>

              <Box sx={{ gridArea: 'shift', minWidth: 0 }}>
                {row.off ? (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Descanso
                  </Typography>
                ) : (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
                    <TextField
                      size="small"
                      type="time"
                      value={row.startTime}
                      onChange={(e) => updateRow(dayOfWeek, { startTime: e.target.value })}
                      slotProps={{ htmlInput: { 'aria-label': `Entrada ${WEEKDAY_FULL_LABELS[dayOfWeek]}` } }}
                      sx={{ width: 150 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      a
                    </Typography>
                    <TextField
                      size="small"
                      type="time"
                      value={row.endTime}
                      onChange={(e) => updateRow(dayOfWeek, { endTime: e.target.value })}
                      slotProps={{ htmlInput: { 'aria-label': `Salida ${WEEKDAY_FULL_LABELS[dayOfWeek]}` } }}
                      sx={{ width: 150 }}
                    />
                    {multiBranch && !sameBranch && (
                      <TextField
                        select
                        size="small"
                        value={row.branchId}
                        onChange={(e) => updateRow(dayOfWeek, { branchId: e.target.value })}
                        slotProps={{
                          select: { displayEmpty: true },
                          htmlInput: { 'aria-label': `Sede ${WEEKDAY_FULL_LABELS[dayOfWeek]}` },
                        }}
                        sx={{ minWidth: 180 }}
                      >
                        {branchOptions}
                      </TextField>
                    )}
                  </Stack>
                )}
              </Box>

              <FormControlLabel
                sx={{ gridArea: 'off', m: 0 }}
                control={
                  <Checkbox
                    size="small"
                    checked={row.off}
                    onChange={(e) => updateRow(dayOfWeek, { off: e.target.checked })}
                  />
                }
                label={<Typography variant="body2">Descanso</Typography>}
              />
            </Box>
          );
        })}
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Button variant="outlined" size="small" loading={saving} onClick={handleSave}>
          {saveLabel}
        </Button>
        <Typography variant="caption" color="text.secondary">
          {workDays === 1 ? '1 día de trabajo' : `${workDays} días de trabajo`}, {7 - workDays} de descanso
        </Typography>
      </Stack>
    </Stack>
  );
}
