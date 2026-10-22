import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import { FlaskConical } from 'lucide-react';
import { env } from '../../config/env';

/**
 * "STAGING", only in the demo environment (built with VITE_APP_ENV=staging,
 * or a phone app talking to staging), so nobody mistakes it for the real
 * system. "LOCAL" for a phone app talking to a computer. Renders nothing in
 * production.
 */
export default function EnvironmentChip() {
  if (env.serverTarget === 'local') {
    return (
      <Tooltip title={`Conectada a ${env.apiBaseUrl}`}>
        <Chip
          icon={<FlaskConical size={14} />}
          label="LOCAL"
          color="info"
          size="small"
          sx={{ fontWeight: 800, letterSpacing: 0.5 }}
        />
      </Tooltip>
    );
  }
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
