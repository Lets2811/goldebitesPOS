import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import { X } from 'lucide-react';

interface DetailDrawerProps {
  open: boolean;
  title: string;
  subtitle?: string;
  headerExtra?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
}

export default function DetailDrawer({
  open,
  title,
  subtitle,
  headerExtra,
  onClose,
  footer,
  width = 520,
  children,
}: DetailDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: width } } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", p: 2.5 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {headerExtra}
            <IconButton onClick={onClose} aria-label="Cerrar">
              <X size={18} />
            </IconButton>
          </Stack>
        </Stack>
        <Divider />
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>{children}</Box>
        {footer && (
          <>
            <Divider />
            <Box sx={{ p: 2.5 }}>{footer}</Box>
          </>
        )}
      </Box>
    </Drawer>
  );
}
