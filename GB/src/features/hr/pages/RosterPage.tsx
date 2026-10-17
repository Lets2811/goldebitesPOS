import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import HrSectionHeader from '../components/HrSectionHeader';
import EmptyState from '../../../components/common/EmptyState';
import ErrorState from '../../../components/common/ErrorState';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import StatusChip, { type StatusTone } from '../../../components/common/StatusChip';
import PeriodPicker from '../../finances/components/PeriodPicker';
import { periodAround, type Period } from '../../finances/period';
import { useBranches } from '../../../modules/branches/hooks/use-branches';
import { EMPLOYEE_STATUS_LABELS, WEEKDAY_LABELS } from '../../../modules/employees/employee-status';
import { useRoster } from '../../../modules/hr/hooks/use-roster';
import { LEAVE_TYPE_LABELS } from '../../../modules/hr/hr-labels';
import type { RosterDay, RosterEntry } from '../../../modules/hr/types/hr.types';
import { useRoles } from '../../../modules/roles/hooks/use-roles';
import { getRoleLabel } from '../../../modules/roles/role-labels';
import { brand } from '../../../theme/palette';

const DAY = 'YYYY-MM-DD';

function absenceLabel(entry: RosterEntry): string | null {
  if (!entry.absence) return null;
  return entry.absence.kind === 'LEAVE'
    ? LEAVE_TYPE_LABELS[entry.absence.type]
    : EMPLOYEE_STATUS_LABELS[entry.absence.status];
}

const fullName = (entry: RosterEntry) => `${entry.firstName} ${entry.lastName}`;

/** Si un turno de hoy ya empezó, está en curso o terminó, a la hora del equipo. Un turno que cruza la medianoche termina al día siguiente. */
function shiftMoment(entry: RosterEntry, date: string): { label: string; tone: StatusTone } | null {
  const today = dayjs().format(DAY);
  if (date !== today) return null;
  const now = dayjs().format('HH:mm');
  const overnight = entry.endTime <= entry.startTime;
  if (now < entry.startTime) return { label: `Entra ${entry.startTime}`, tone: 'neutral' };
  if (overnight || now < entry.endTime) return { label: 'En turno', tone: 'success' };
  return { label: 'Terminó', tone: 'neutral' };
}

/** Para nombrar sedes y cargos sin repetir búsquedas en cada fila. */
function useLookups() {
  const { data: branchPage } = useBranches({ isActive: true, limit: 50 });
  const { data: roles } = useRoles();
  const branches = useMemo(() => branchPage?.data ?? [], [branchPage]);
  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);
  const roleName = useMemo(() => new Map((roles ?? []).map((r) => [r.id, getRoleLabel(r.name)])), [roles]);
  return { branches, branchName, roleName };
}

type Lookups = ReturnType<typeof useLookups>;

function DayView({ day, lookups }: { day: RosterDay; lookups: Lookups }) {
  const multiBranch = lookups.branches.length > 1;
  if (day.entries.length === 0) {
    return <EmptyState title="Nadie tiene turno este día" description="Todos descansan según su horario." />;
  }
  const present = day.entries.filter((entry) => !entry.absence);
  const onShiftNow = present.filter((entry) => shiftMoment(entry, day.date)?.label === 'En turno').length;
  const absent = day.entries.length - present.length;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <Chip label={`${present.length} programados`} />
        {day.date === dayjs().format(DAY) && <Chip color="success" variant="outlined" label={`${onShiftNow} en turno ahora`} />}
        {absent > 0 && <Chip color="warning" variant="outlined" label={`${absent} ausentes`} />}
      </Stack>
      <Card variant="outlined">
        {day.entries.map((entry, index) => {
          const moment = shiftMoment(entry, day.date);
          const absence = absenceLabel(entry);
          return (
            <Stack
              key={`${entry.employeeId}-${entry.startTime}`}
              direction="row"
              spacing={2}
              sx={{
                alignItems: 'center',
                px: 2,
                py: 1.5,
                borderTop: index === 0 ? 'none' : '1px solid',
                borderColor: 'divider',
                opacity: absence ? 0.7 : 1,
              }}
            >
              <Typography variant="body2" sx={{ width: 108, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {entry.startTime} – {entry.endTime}
              </Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, textDecoration: absence ? 'line-through' : 'none' }} noWrap>
                  {fullName(entry)}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {[entry.roleId ? lookups.roleName.get(entry.roleId) : null, multiBranch && entry.branchId ? lookups.branchName.get(entry.branchId) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              </Box>
              {absence ? (
                <StatusChip label={`Ausente: ${absence}`} tone="warning" />
              ) : (
                moment && <StatusChip label={moment.label} tone={moment.tone} />
              )}
            </Stack>
          );
        })}
      </Card>
    </Stack>
  );
}

function WeekView({ days, lookups }: { days: RosterDay[]; lookups: Lookups }) {
  const today = dayjs().format(DAY);
  const multiBranch = lookups.branches.length > 1;
  const people = useMemo(() => {
    const byId = new Map<string, RosterEntry>();
    for (const day of days) for (const entry of day.entries) if (!byId.has(entry.employeeId)) byId.set(entry.employeeId, entry);
    return [...byId.values()].sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [days]);

  if (people.length === 0) {
    return <EmptyState title="Nadie tiene turno esta semana" />;
  }

  return (
    <Card variant="outlined" sx={{ overflowX: 'auto' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: `180px repeat(${days.length}, minmax(104px, 1fr))`, minWidth: 900 }}>
        <Box sx={{ p: 1.5 }} />
        {days.map((day) => (
          <Box
            key={day.date}
            sx={{
              p: 1.5,
              textAlign: 'center',
              backgroundColor: day.date === today ? alpha(brand.gold, 0.1) : 'transparent',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block' }}>
              {WEEKDAY_LABELS[dayjs(day.date).day()]}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {dayjs(day.date).date()}
            </Typography>
          </Box>
        ))}
        {people.map((person) => (
          <Box key={person.employeeId} sx={{ display: 'contents' }}>
            <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {fullName(person)}
              </Typography>
              {person.roleId && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {lookups.roleName.get(person.roleId)}
                </Typography>
              )}
            </Box>
            {days.map((day) => {
              const entries = day.entries.filter((entry) => entry.employeeId === person.employeeId);
              return (
                <Box
                  key={day.date}
                  sx={{
                    p: 0.75,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: day.date === today ? alpha(brand.gold, 0.05) : 'transparent',
                  }}
                >
                  {entries.length === 0 ? (
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', py: 0.75 }}>
                      Descanso
                    </Typography>
                  ) : (
                    entries.map((entry) => {
                      const absence = absenceLabel(entry);
                      return (
                        <Box
                          key={entry.startTime}
                          sx={{
                            py: 0.75,
                            px: 0.5,
                            borderRadius: 1.5,
                            textAlign: 'center',
                            backgroundColor: absence ? 'transparent' : alpha(brand.gold, 0.12),
                            border: '1px solid',
                            borderColor: absence ? 'warning.main' : alpha(brand.gold, 0.3),
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                            {absence ?? `${entry.startTime}–${entry.endTime}`}
                          </Typography>
                          {multiBranch && entry.branchId && !absence && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                              {lookups.branchName.get(entry.branchId)}
                            </Typography>
                          )}
                        </Box>
                      );
                    })
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Card>
  );
}

function MonthView({ days, onPickDay }: { days: RosterDay[]; onPickDay: (date: string) => void }) {
  const today = dayjs().format(DAY);
  // Huecos antes del día 1 para que cada fecha caiga bajo su día de la semana (lunes primero).
  const leading = (dayjs(days[0]?.date).day() + 6) % 7;
  const weekHeader = [1, 2, 3, 4, 5, 6, 0].map((dow) => WEEKDAY_LABELS[dow]);

  return (
    <Card variant="outlined" sx={{ p: 1.5, overflowX: 'auto' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))', gap: 1, minWidth: 800 }}>
        {weekHeader.map((label) => (
          <Typography key={label} variant="caption" color="text.secondary" sx={{ fontWeight: 700, textAlign: 'center' }}>
            {label}
          </Typography>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <Box key={`empty-${i}`} />
        ))}
        {days.map((day) => {
          const present = day.entries.filter((entry) => !entry.absence);
          const absent = day.entries.length - present.length;
          return (
            <Box
              key={day.date}
              component="button"
              type="button"
              onClick={() => onPickDay(day.date)}
              sx={{
                all: 'unset',
                boxSizing: 'border-box',
                cursor: 'pointer',
                minHeight: 112,
                p: 1,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: day.date === today ? brand.gold : 'divider',
                backgroundColor: day.date === today ? alpha(brand.gold, 0.08) : 'transparent',
                '&:hover': { backgroundColor: alpha(brand.gold, 0.12) },
                '&:focus-visible': { outline: `2px solid ${brand.gold}` },
              }}
            >
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {dayjs(day.date).date()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {present.length > 0 ? `${present.length} en turno` : 'Sin turnos'}
                </Typography>
              </Stack>
              {present.slice(0, 3).map((entry) => (
                <Typography key={`${entry.employeeId}-${entry.startTime}`} variant="caption" sx={{ display: 'block' }} noWrap>
                  {entry.startTime} {entry.firstName}
                </Typography>
              ))}
              {present.length > 3 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  +{present.length - 3} más
                </Typography>
              )}
              {absent > 0 && (
                <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
                  {absent} ausente{absent === 1 ? '' : 's'}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Card>
  );
}

/** Turno efectivo: quién debería estar trabajando hoy, esta semana o este mes, según los horarios y los permisos aprobados. */
export default function RosterPage() {
  const [period, setPeriod] = useState<Period>(() => periodAround('day'));
  const [branchId, setBranchId] = useState('');
  const lookups = useLookups();
  const { data: days, isLoading, isError, refetch } = useRoster(period.from, period.to, branchId || undefined);

  return (
    <>
      <HrSectionHeader description="Quién debería estar trabajando, según el horario de cada empleado y los permisos aprobados." />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2.5, alignItems: { md: 'center' } }}>
        <Box sx={{ flex: 1 }}>
          <PeriodPicker value={period} onChange={setPeriod} modes={['day', 'week', 'month']} />
        </Box>
        {lookups.branches.length > 1 && (
          <TextField
            select
            size="small"
            label="Sede"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Todas las sedes</MenuItem>
            {lookups.branches.map((branch) => (
              <MenuItem key={branch.id} value={branch.id}>
                {branch.name}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading || !days ? (
        <LoadingSkeleton variant="list" />
      ) : period.mode === 'day' ? (
        <DayView day={days[0]} lookups={lookups} />
      ) : period.mode === 'week' ? (
        <WeekView days={days} lookups={lookups} />
      ) : (
        <MonthView days={days} onPickDay={(date) => setPeriod(periodAround('day', dayjs(date)))} />
      )}
    </>
  );
}
