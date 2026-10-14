import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  describePeriod,
  includesToday,
  periodAround,
  shiftPeriod,
  type Period,
  type PeriodMode,
} from '../period';

const MODES: { value: PeriodMode; label: string }[] = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'range', label: 'Rango' },
];

const PREVIOUS: Record<PeriodMode, string> = {
  day: 'Día anterior',
  week: 'Semana anterior',
  month: 'Mes anterior',
  range: 'Rango anterior',
};
const NEXT: Record<PeriodMode, string> = {
  day: 'Día siguiente',
  week: 'Semana siguiente',
  month: 'Mes siguiente',
  range: 'Rango siguiente',
};
const BACK_TO_TODAY: Record<PeriodMode, string> = {
  day: 'Hoy',
  week: 'Esta semana',
  month: 'Este mes',
  range: 'Este mes',
};

interface PeriodPickerProps {
  value: Period;
  onChange: (period: Period) => void;
}

/** Elige qué período muestra Finanzas: un día, una semana, un mes o un rango de fechas, y permite moverse entre ellos. */
export default function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={1.5}
      sx={{ alignItems: { md: 'center' }, flexWrap: 'wrap', rowGap: 1.5 }}
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value.mode}
        onChange={(_, mode: PeriodMode | null) => mode && onChange(periodAround(mode))}
      >
        {MODES.map((mode) => (
          <ToggleButton key={mode.value} value={mode.value} sx={{ px: 2, fontWeight: 700 }}>
            {mode.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <Tooltip title={PREVIOUS[value.mode]}>
          <IconButton size="small" onClick={() => onChange(shiftPeriod(value, -1))} aria-label={PREVIOUS[value.mode]}>
            <ChevronLeft size={18} />
          </IconButton>
        </Tooltip>

        {value.mode === 'range' ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              size="small"
              type="date"
              label="Desde"
              value={value.from}
              onChange={(e) => {
                const from = e.target.value;
                // Un rango no puede terminar antes de empezar.
                if (from) onChange({ ...value, from, to: from > value.to ? from : value.to });
              }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              type="date"
              label="Hasta"
              value={value.to}
              onChange={(e) => {
                const to = e.target.value;
                if (to) onChange({ ...value, to, from: to < value.from ? to : value.from });
              }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        ) : (
          <Typography variant="subtitle2" sx={{ fontWeight: 700, minWidth: 150, textAlign: 'center' }}>
            {describePeriod(value)}
          </Typography>
        )}

        <Tooltip title={NEXT[value.mode]}>
          <IconButton size="small" onClick={() => onChange(shiftPeriod(value, 1))} aria-label={NEXT[value.mode]}>
            <ChevronRight size={18} />
          </IconButton>
        </Tooltip>
      </Stack>

      {!includesToday(value) && (
        <Button size="small" onClick={() => onChange(periodAround(value.mode))}>
          {BACK_TO_TODAY[value.mode]}
        </Button>
      )}
    </Stack>
  );
}
