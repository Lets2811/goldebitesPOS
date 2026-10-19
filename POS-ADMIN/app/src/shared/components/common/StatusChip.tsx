import Chip from '@mui/material/Chip';
import { alpha, useTheme } from '@mui/material/styles';
import { statusColors, brand } from '../../theme/palette';

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'gold';

interface StatusChipProps {
  label: string;
  tone?: StatusTone;
  size?: 'small' | 'medium';
  icon?: React.ReactElement;
}

const TONE_COLOR: Record<StatusTone, string> = {
  success: statusColors.success,
  warning: statusColors.warning,
  error: statusColors.error,
  info: statusColors.info,
  neutral: statusColors.neutral,
  gold: brand.gold,
};

export default function StatusChip({ label, tone = 'neutral', size = 'small', icon }: StatusChipProps) {
  const theme = useTheme();
  const color = TONE_COLOR[tone];
  return (
    <Chip
      label={label}
      size={size}
      icon={icon}
      sx={{
        color,
        backgroundColor: alpha(color, theme.palette.mode === 'dark' ? 0.16 : 0.12),
        border: `1px solid ${alpha(color, 0.4)}`,
        '& .MuiChip-icon': { color },
      }}
    />
  );
}
