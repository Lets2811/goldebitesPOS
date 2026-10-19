import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import { FlaskConical } from 'lucide-react';
import { env } from '../../config/env';

/**
 * "STAGING", only in the demo environment (built with VITE_APP_ENV=staging),
 * so nobody mistakes it for the real system. Renders nothing in production.
 */
export default function EnvironmentChip() {
  if (!env.isStaging) return null;
  return (
    <Tooltip title="Ambiente de demostración: los datos no son reales y no afectan la operación.">
      <Chip
        icon={<FlaskConical size={14} />}
        label="STAGING"
        color="warning"
        size="small"
        sx={{ fontWeight: 800, letterSpacing: 0.5 }}
      />
    </Tooltip>
  );
}
