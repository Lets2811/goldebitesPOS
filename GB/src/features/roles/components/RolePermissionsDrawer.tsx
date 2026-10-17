import { useState } from 'react';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { useSnackbar } from 'notistack';
import DetailDrawer from '../../../components/common/DetailDrawer';
import { Can } from '../../../modules/auth/components/can';
import { useRole } from '../../../modules/roles/hooks/use-role';
import { useSetRolePermissions } from '../../../modules/roles/hooks/use-set-role-permissions';
import { normalizeApiError } from '../../../lib/api/api-error';
import { getRoleLabel } from '../../../modules/roles/role-labels';
import PermissionChecklist from './PermissionChecklist';

interface RolePermissionsDrawerProps {
  roleId: string | null;
  onClose: () => void;
  onEdit: () => void;
}

export default function RolePermissionsDrawer({ roleId, onClose, onEdit }: RolePermissionsDrawerProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { data: role } = useRole(roleId);
  const setPermissions = useSetRolePermissions();

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  if (role && initializedFor !== role.id) {
    setInitializedFor(role.id);
    setChecked(new Set(role.permissions));
  }

  if (!roleId || !role) return null;

  const hasChanges =
    checked.size !== role.permissions.length || role.permissions.some((code) => !checked.has(code));

  return (
    <DetailDrawer
      open={Boolean(roleId)}
      onClose={onClose}
      title={getRoleLabel(role.name)}
      subtitle={role.description ?? undefined}
      width={560}
      footer={
        <Can permission="roles.manage">
          <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
            <Button variant="outlined" onClick={onEdit}>
              Editar nombre
            </Button>
            <Button
              variant="contained"
              disabled={!hasChanges}
              loading={setPermissions.isPending}
              onClick={() => {
                setPermissions.mutate(
                  { id: role.id, permissionCodes: Array.from(checked) },
                  {
                    onSuccess: () =>
                      enqueueSnackbar('Permisos actualizados correctamente', { variant: 'success' }),
                    onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
                  },
                );
              }}
            >
              Guardar permisos
            </Button>
          </Stack>
        </Can>
      }
    >
      <PermissionChecklist checked={checked} onChange={setChecked} />
    </DetailDrawer>
  );
}
