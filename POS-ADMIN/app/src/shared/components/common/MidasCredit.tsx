import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import { brand } from '../../theme/palette';
import midasTechMark from '../../../assets/midas-tech.png';

const SLOGAN = 'Donde las ideas se vuelven';

/**
 * The credit of who builds the app, centered at the foot of a screen.
 * - `full`: the Midas Tech mark, and under it the name and the slogan (sign-in and public screens).
 * - `inline`: the mark with the name beside it, for the screens inside the app.
 * - `mark`: the mark alone, for a narrow space like the collapsed side menu.
 * The slogan shows on hover where it is not written.
 */
export default function MidasCredit({
  variant = 'full',
  sx,
}: {
  variant?: 'full' | 'inline' | 'mark';
  sx?: SxProps<Theme>;
}) {
  const year = new Date().getFullYear();
  const mark = (
    <Box
      component="img"
      src={midasTechMark}
      alt="Midas Tech"
      sx={{ height: variant === 'full' ? 28 : 18, width: 'auto', display: 'block' }}
    />
  );

  if (variant !== 'full') {
    return (
      <Tooltip title={`© ${year} Midas Tech · ${SLOGAN} oro`} placement="top">
        <Stack
          direction="row"
          sx={[
            { alignItems: 'center', justifyContent: 'center', gap: 0.75, opacity: 0.85 },
            ...(Array.isArray(sx) ? sx : [sx]),
          ]}
        >
          {mark}
          {variant === 'inline' && (
            <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
              Midas Tech
            </Typography>
          )}
        </Stack>
      </Tooltip>
    );
  }

  return (
    <Stack
      sx={[
        { alignItems: 'center', textAlign: 'center', gap: 0.5, opacity: 0.9 },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {mark}
      <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>
        © {year} Midas Tech
        <br />
        {SLOGAN}{' '}
        <Box component="span" sx={{ color: brand.gold, fontWeight: 700 }}>
          oro
        </Box>
      </Typography>
    </Stack>
  );
}
