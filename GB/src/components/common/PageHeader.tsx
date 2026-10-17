import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ArrowLeft } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import Breadcrumbs, { type BreadcrumbItem } from './Breadcrumbs';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  /**
   * Una subpantalla: un botón claro para volver a la pantalla de la que sale
   * (ej. "Volver a Productos y recetas"), en lugar de las migas de pan.
   */
  backTo?: { label: string; path: string };
}

export default function PageHeader({ title, subtitle, breadcrumbs, actions, backTo }: PageHeaderProps) {
  return (
    <Box sx={{ mb: 3 }}>
      {backTo ? (
        <Button
          component={RouterLink}
          to={backTo.path}
          size="small"
          startIcon={<ArrowLeft size={16} />}
          sx={{ mb: 1, ml: -1, fontWeight: 600 }}
        >
          Volver a {backTo.label}
        </Button>
      ) : (
        breadcrumbs &&
        breadcrumbs.length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Breadcrumbs items={breadcrumbs} />
          </Box>
        )
      )}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && (
          <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
            {actions}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
