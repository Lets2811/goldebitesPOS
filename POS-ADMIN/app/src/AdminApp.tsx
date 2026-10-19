import { useMemo } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { BrowserRouter } from 'react-router-dom';
import { queryClient } from './shared/lib/query-client';
import { useUiStore } from './shared/store/uiStore';
import { buildTheme } from './shared/theme/theme';
import AdminRoutes from './routes';

/** The Admin app: same theme and providers as the POS, its own routes and session. */
export default function AdminApp() {
  const themeMode = useUiStore((s) => s.themeMode);
  const theme = useMemo(() => buildTheme(themeMode), [themeMode]);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} autoHideDuration={3500}>
          <BrowserRouter>
            <AdminRoutes />
          </BrowserRouter>
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
