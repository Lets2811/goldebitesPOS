import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import { brand } from '../../theme/palette';
import midasTechMark from '../../assets/midas-tech.png';

const SLOGAN = 'Donde las ideas se vuelven';

/**
 * The credit of who builds the app: the Midas Tech mark, and under it the
 * name and its slogan, centered at the foot of a screen. `compact` leaves
 * only the mark (a narrow space, like the collapsed side menu); the words
 * show on hover.
 */
export default function MidasCredit({ compact = false, sx }: { compact?: boolean; sx?: SxProps<Theme> }) {
  const year = new Date().getFullYear();
  const mark = (
    <Box
      component="img"
      src={midasTechMark}
      alt="Midas Tech"
      sx={{ height: compact ? 22 : 28, width: 'auto', display: 'block' }}
    />
  );

  return (
    <Stack
      sx={[
        { alignItems: 'center', textAlign: 'center', gap: 0.5, opacity: 0.9 },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {compact ? (
        <Tooltip title={`© ${year} Midas Tech · ${SLOGAN} oro`} placement="right">
          {mark}
        </Tooltip>
      ) : (
        <>
          {mark}
          <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>
            © {year} Midas Tech
            <br />
            {SLOGAN}{' '}
            <Box component="span" sx={{ color: brand.gold, fontWeight: 700 }}>
              oro
            </Box>
          </Typography>
        </>
      )}
    </Stack>
  );
}
