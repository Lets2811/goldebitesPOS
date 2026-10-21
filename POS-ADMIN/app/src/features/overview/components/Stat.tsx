import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/** One figure with its label, and optionally a line of context under it. */
export default function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 20, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}

/** Figures side by side, wrapping on narrow screens. */
export function StatRow({ children, min = 140 }: { children: React.ReactNode; min?: number }) {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}>
      {children}
    </Box>
  );
}
