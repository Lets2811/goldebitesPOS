import { useState } from 'react';
import Stack from '@mui/material/Stack';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import { KeyRound } from 'lucide-react';
import { useSnackbar } from 'notistack';
import DetailDrawer from '../../../shared/components/common/DetailDrawer';
import LoadingSkeleton from '../../../shared/components/common/LoadingSkeleton';
import CredentialsRevealDialog from '../../../shared/features/employees/components/CredentialsRevealDialog';
import { useBusinessFeatures } from '../../../modules/businesses/hooks/use-business-features';
import { useSetBusinessFeature } from '../../../modules/businesses/hooks/use-set-business-feature';
import { useBusinessUsers } from '../../../modules/businesses/hooks/use-business-users';
import { useResetUserPassword } from '../../../modules/businesses/hooks/use-reset-user-password';
import { normalizeApiError } from '../../../shared/lib/api/api-error';
import type { BusinessRef, BusinessUserSummary } from '../../../modules/businesses/types/platform-admin.types';

interface BusinessFeaturesDrawerProps {
  business: BusinessRef | null;
  onClose: () => void;
}

export default function BusinessFeaturesDrawer({ business, onClose }: BusinessFeaturesDrawerProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { data: features, isLoading } = useBusinessFeatures(business?.id ?? null);
  const setFeature = useSetBusinessFeature(business?.id ?? '');
  const { data: users, isLoading: usersLoading } = useBusinessUsers(business?.id ?? null);
  const resetPassword = useResetUserPassword(business?.id ?? '');

  const [revealFor, setRevealFor] = useState<BusinessUserSummary | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  if (!business) return null;

  const handleReset = (user: BusinessUserSummary) => {
    resetPassword.mutate(user.id, {
      onSuccess: (data) => {
        setRevealFor(user);
        setTemporaryPassword(data.temporaryPassword);
      },
      onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
    });
  };

  return (
    <>
      <DetailDrawer
        open={Boolean(business)}
        onClose={onClose}
        title={business.name}
        subtitle="Módulos y accesos de esta empresa"
        width={420}
      >
        {isLoading || !features ? (
          <LoadingSkeleton variant="page" />
        ) : (
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Desmarca un módulo para quitarle el acceso a esta empresa. El cambio aplica en su próximo inicio de
              sesión (o al refrescar el token).
            </Typography>
            {features.map((feature) => (
              <div key={feature.key}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={feature.enabled}
                      onChange={(e) => setFeature.mutate({ featureKey: feature.key, enabled: e.target.checked })}
                    />
                  }
                  label={feature.label}
                />
                {feature.subFeatures?.map((sub) => (
                  <FormControlLabel
                    key={sub.key}
                    sx={{ ml: 3, display: 'flex' }}
                    control={
                      <Checkbox
                        checked={sub.enabled}
                        disabled={!feature.enabled}
                        onChange={(e) => setFeature.mutate({ featureKey: sub.key, enabled: e.target.checked })}
                      />
                    }
                    label={
                      <Typography variant="body2" color={feature.enabled ? 'text.primary' : 'text.disabled'}>
                        {sub.label}
                      </Typography>
                    }
                  />
                ))}
              </div>
            ))}

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Usuarios
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Si el dueño de esta empresa perdió su acceso, restablece su contraseña aquí.
            </Typography>
            {usersLoading || !users ? (
              <LoadingSkeleton variant="page" />
            ) : (
              <Stack spacing={1}>
                {users.map((user) => (
                  <Stack
                    key={user.id}
                    direction="row"
                    sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Stack sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {user.firstName} {user.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {user.email} · {user.roleName}
                      </Typography>
                    </Stack>
                    <Button
                      size="small"
                      startIcon={<KeyRound size={14} />}
                      onClick={() => handleReset(user)}
                      disabled={resetPassword.isPending}
                    >
                      Restablecer
                    </Button>
                  </Stack>
                ))}
                {users.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Esta empresa aún no tiene usuarios.
                  </Typography>
                )}
              </Stack>
            )}
          </Stack>
        )}
      </DetailDrawer>

      <CredentialsRevealDialog
        open={Boolean(temporaryPassword)}
        email={revealFor?.email}
        temporaryPassword={temporaryPassword}
        onClose={() => {
          setTemporaryPassword(null);
          setRevealFor(null);
        }}
      />
    </>
  );
}
