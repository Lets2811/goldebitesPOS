import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import PageHeader from '../../../shared/components/common/PageHeader';
import LoadingSkeleton from '../../../shared/components/common/LoadingSkeleton';
import { usePlatformFeatureFlags } from '../../../modules/businesses/hooks/use-platform-feature-flags';
import { useSetPlatformFeatureFlag } from '../../../modules/businesses/hooks/use-set-platform-feature-flag';
import type { PlatformFeatureFlagStatus } from '../../../modules/businesses/types/platform-admin.types';

export default function FeatureFlagsPage() {
  const { data: flags, isLoading } = usePlatformFeatureFlags();
  const setFlag = useSetPlatformFeatureFlag();

  const modules = groupByModule(flags ?? []);

  return (
    <>
      <PageHeader
        title="Feature Flags"
        subtitle="Funcionalidades activas o apagadas para toda la plataforma, sin importar el negocio."
        breadcrumbs={[{ label: 'Plataforma', path: '/plataforma' }, { label: 'Feature Flags' }]}
      />

      {isLoading || !flags ? (
        <LoadingSkeleton variant="page" />
      ) : (
        <Box sx={{ maxWidth: 520 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            El cambio aplica a todos los negocios en su próximo inicio de sesión (o al refrescar el token).
          </Typography>
          <Stack spacing={2} divider={<Divider />}>
            {modules.map(({ moduleKey, moduleLabel, moduleEntry, subEntries }) => (
              <Box key={moduleKey}>
                {moduleEntry && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={moduleEntry.enabled}
                        onChange={(e) =>
                          setFlag.mutate({ featureKey: moduleEntry.key, enabled: e.target.checked })
                        }
                      />
                    }
                    label={<Typography sx={{ fontWeight: 700 }}>{moduleLabel}</Typography>}
                  />
                )}
                {subEntries.map((sub) => (
                  <FormControlLabel
                    key={sub.key}
                    sx={{ ml: 3, display: 'flex' }}
                    control={
                      <Checkbox
                        checked={sub.enabled}
                        disabled={moduleEntry ? !moduleEntry.enabled : false}
                        onChange={(e) => setFlag.mutate({ featureKey: sub.key, enabled: e.target.checked })}
                      />
                    }
                    label={
                      <Typography
                        variant="body2"
                        color={!moduleEntry || moduleEntry.enabled ? 'text.primary' : 'text.disabled'}
                      >
                        {sub.label}
                      </Typography>
                    }
                  />
                ))}
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </>
  );
}

interface ModuleGroup {
  moduleKey: string;
  moduleLabel: string;
  moduleEntry: PlatformFeatureFlagStatus | undefined;
  subEntries: PlatformFeatureFlagStatus[];
}

function groupByModule(flags: PlatformFeatureFlagStatus[]): ModuleGroup[] {
  const groups = new Map<string, ModuleGroup>();
  for (const flag of flags) {
    if (!groups.has(flag.moduleKey)) {
      groups.set(flag.moduleKey, {
        moduleKey: flag.moduleKey,
        moduleLabel: flag.moduleLabel,
        moduleEntry: undefined,
        subEntries: [],
      });
    }
    const group = groups.get(flag.moduleKey)!;
    if (flag.key === flag.moduleKey) {
      group.moduleEntry = flag;
    } else {
      group.subEntries.push(flag);
    }
  }
  return Array.from(groups.values());
}
