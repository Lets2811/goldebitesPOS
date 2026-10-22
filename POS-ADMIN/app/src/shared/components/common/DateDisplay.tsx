import Typography, { type TypographyProps } from '@mui/material/Typography';
import { formatDateCO, formatDateTimeCO, formatTimeCO } from '../../utils/format';

interface DateDisplayProps extends Omit<TypographyProps, 'children'> {
  value: string | Date;
  mode?: 'date' | 'datetime' | 'time';
}

export default function DateDisplay({ value, mode = 'date', ...rest }: DateDisplayProps) {
  const formatted =
    mode === 'datetime'
      ? formatDateTimeCO(value)
      : mode === 'time'
        ? formatTimeCO(value)
        : formatDateCO(value);
  return <Typography {...rest}>{formatted}</Typography>;
}
