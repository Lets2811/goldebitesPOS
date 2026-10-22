import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LogOut } from 'lucide-react';
import EnvironmentChip from '../../../components/common/EnvironmentChip';
import BranchChooser from '../../branches/components/BranchChooser';
import { useCurrentBusiness } from '../../businesses/hooks/use-current-business';
import { brand } from '../../../theme/palette';
import { useLogout } from '../hooks/use-logout';
import { useAuthStore } from '../store/auth.store';
import MidasCredit from '../../../components/common/MidasCredit';

/**
 * Right after signing in, someone who may work at every branch picks which
 * one. Nothing of the app loads behind it until then: the API refuses it too.
 */
export default function BranchPickerPage() {
  const { data: business } = useCurrentBusiness();
  const firstName = useAuthStore((s) => s.user?.firstName);
  const logout = useLogout();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 2,
        bgcolor: brand.black,
        px: 2,
        py: 4,
      }}
    >
      <Paper sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 460 }} elevation={4}>
        <Stack spacing={3}>
          <Box sx={{ textAlign: 'center' }}>
            <EnvironmentChip />
            <Typography variant="h5" sx={{ fontWeight: 800, color: brand.gold }}>
              {business?.name ?? 'Golden Bites'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {firstName ? `Hola, ${firstName}. ` : ''}¿En qué sede vas a trabajar?
            </Typography>
          </Box>
          <BranchChooser />
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            Puedes cambiar de sede cuando quieras desde el menú lateral.
          </Typography>
          <Button
            color="inherit"
            startIcon={<LogOut size={16} />}
            loading={logout.isPending}
            onClick={() => logout.mutate()}
            sx={{ alignSelf: 'center', color: 'text.secondary' }}
          >
            Cerrar sesión
          </Button>
        </Stack>
      </Paper>
      <MidasCredit />
    </Box>
  );
}
