import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { brand } from '../../../shared/theme/palette';

/**
 * A row of bars, one per item, scaled to the largest. Enough to see a trend
 * at a glance; each bar says its value on hover.
 */
export default function Bars({
  items,
  height = 96,
  empty = 'Sin datos en el período',
}: {
  items: { key: string; value: number; label: string }[];
  height?: number;
  empty?: string;
}) {
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        {empty}
      </Typography>
    );
  }
  const max = Math.max(...items.map((item) => item.value), 0) || 1;
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height }}>
      {items.map((item) => (
        <Tooltip key={item.key} title={item.label} arrow>
          <Box
            sx={{
              flex: 1,
              minWidth: 4,
              height: `${Math.max(3, (item.value / max) * 100)}%`,
              bgcolor: brand.gold,
              opacity: 0.85,
              borderRadius: '3px 3px 0 0',
              '&:hover': { opacity: 1 },
            }}
          />
        </Tooltip>
      ))}
    </Box>
  );
}
