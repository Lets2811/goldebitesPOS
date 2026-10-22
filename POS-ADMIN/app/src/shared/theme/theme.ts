import { createTheme, type ThemeOptions } from '@mui/material/styles';
import { brand, statusColors } from './palette';

export type ThemeMode = 'dark' | 'light';

const shared: ThemeOptions = {
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: [
      '"Inter"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'Helvetica',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 700, letterSpacing: -0.5 },
    h2: { fontWeight: 700, letterSpacing: -0.5 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
    overline: { letterSpacing: 1.2, fontWeight: 600 },
  },
};

export function buildTheme(mode: ThemeMode) {
  const isDark = mode === 'dark';

  return createTheme({
    ...shared,
    palette: {
      mode,
      primary: { main: brand.gold, light: brand.goldLight, dark: brand.goldDark, contrastText: brand.black },
      secondary: { main: brand.boneMuted, contrastText: brand.black },
      success: { main: statusColors.success },
      warning: { main: statusColors.warning },
      error: { main: statusColors.error },
      info: { main: statusColors.info },
      background: {
        default: isDark ? brand.black : '#F4F2EC',
        paper: isDark ? brand.blackElevated : '#FFFFFF',
      },
      text: {
        primary: isDark ? brand.bone : '#1C1B18',
        secondary: isDark ? brand.boneMuted : '#5B584F',
      },
      divider: isDark ? brand.blackBorder : '#E3E0D6',
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: isDark ? `${brand.blackBorder} ${brand.black}` : undefined,
          },
          '*::-webkit-scrollbar': { width: 8, height: 8 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: isDark ? brand.blackBorder : '#D6D2C4',
            borderRadius: 8,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: `1px solid ${isDark ? brand.blackBorder : '#E3E0D6'}`,
            boxShadow: 'none',
            backgroundColor: isDark ? brand.blackElevated : '#FFFFFF',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 8, paddingInline: 16 },
        },
        variants: [
          {
            props: { variant: 'contained', color: 'primary' },
            style: {
              color: brand.black,
              '&:hover': { backgroundColor: brand.goldLight },
            },
          },
        ],
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600 },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? brand.blackElevated : '#FFFFFF',
            backgroundImage: 'none',
            borderBottom: `1px solid ${isDark ? brand.blackBorder : '#E3E0D6'}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? brand.black : '#FFFFFF',
            backgroundImage: 'none',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: isDark ? brand.blackBorder : '#E3E0D6' },
          head: {
            fontWeight: 700,
            textTransform: 'uppercase',
            fontSize: '0.72rem',
            letterSpacing: 0.6,
            color: isDark ? brand.boneMuted : '#5B584F',
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? brand.blackSurface : '#1C1B18',
            border: `1px solid ${brand.blackBorder}`,
            fontSize: '0.75rem',
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { backgroundColor: brand.gold, height: 2 },
        },
      },
    },
  });
}
