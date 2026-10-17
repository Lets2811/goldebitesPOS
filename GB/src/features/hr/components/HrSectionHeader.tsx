import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface HrSectionHeaderProps {
  description: string;
  actions?: React.ReactNode;
}

/** Cabecera de una pestaña de Recursos Humanos: el título y las migas ya los pone HumanResourcesLayout. */
export default function HrSectionHeader({ description, actions }: HrSectionHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ mb: 2.5, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}
    >
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
      {actions && (
        <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}
