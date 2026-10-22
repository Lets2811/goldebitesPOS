import { useMemo } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { BrowserRouter } from 'react-router-dom';
import { buildTheme } from '../theme/theme';
import { useUiStore } from '../store/uiStore';
import { queryClient } from '../lib/query-client';
import AppRoutes from '../routes/AppRoutes';
import PhoneAppRoutes from '../routes/PhoneAppRoutes';
import { env } from '../config/env';

export default function App() {
  const themeMode = useUiStore((s) => s.themeMode);
  const theme = useMemo(() => buildTheme(themeMode), [themeMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          autoHideDuration={3500}
        >
          <BrowserRouter>
            {env.phoneApp ? <PhoneAppRoutes app={env.phoneApp} /> : <AppRoutes />}
          </BrowserRouter>
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
