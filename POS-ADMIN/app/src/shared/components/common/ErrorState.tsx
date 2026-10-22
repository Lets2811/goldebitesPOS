import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import { AlertTriangle } from 'lucide-react';
import { statusColors } from '../../theme/palette';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = 'Ocurrió un error al cargar la información',
  description = 'Intenta nuevamente. Si el problema persiste, contacta al administrador del sistema.',
  onRetry,
}: ErrorStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: 8,
        px: 3,
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(statusColors.error, 0.12),
          color: statusColors.error,
          mb: 2,
        }}
      >
        <AlertTriangle size={26} strokeWidth={1.75} />
      </Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 420 }}>
        {description}
      </Typography>
      {onRetry && (
        <Button variant="outlined" color="error" onClick={onRetry} sx={{ mt: 2.5 }}>
          Reintentar
        </Button>
      )}
    </Box>
  );
}
