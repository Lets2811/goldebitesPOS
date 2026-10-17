import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FormDrawer from '../../../components/common/FormDrawer';
import { roleSchema, type RoleFormValues } from '../schemas/roleSchema';
import type { Role } from '../../../modules/roles/types/role.types';
import PermissionChecklist from './PermissionChecklist';

interface RoleFormDrawerProps {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  /** `permissionCodes` solo al crear: los permisos de un rol existente se editan en RolePermissionsDrawer. */
  onSubmit: (values: RoleFormValues, permissionCodes?: string[]) => void;
  initialRole?: Role | null;
}

const emptyValues: RoleFormValues = { name: '', description: '' };

export default function RoleFormDrawer({
  open,
  loading,
  onClose,
  onSubmit,
  initialRole,
}: RoleFormDrawerProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: emptyValues,
  });
  const [permissionCodes, setPermissionCodes] = useState<Set<string>>(new Set());
  const [wasOpen, setWasOpen] = useState(open);
  const isCreating = !initialRole;

  // Cada vez que se abre, el rol nuevo empieza sin permisos marcados.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPermissionCodes(new Set());
  }

  useEffect(() => {
    if (open) {
      reset(
        initialRole
          ? { name: initialRole.name, description: initialRole.description ?? '' }
          : emptyValues,
      );
    }
  }, [open, initialRole, reset]);

  const submit = handleSubmit((values) =>
    onSubmit(values, isCreating ? Array.from(permissionCodes) : undefined),
  );

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={initialRole ? 'Editar rol' : 'Nuevo rol'}
      submitLabel={initialRole ? 'Guardar cambios' : 'Crear rol'}
      loading={loading}
      width={isCreating ? 560 : 420}
    >
      <Stack spacing={2.5}>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Nombre"
              fullWidth
              error={Boolean(errors.name)}
              helperText={errors.name?.message}
            />
          )}
        />

        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Descripción"
              helperText="Cada empleado con este rol la ve en su perfil."
              multiline
              minRows={2}
              fullWidth
            />
          )}
        />

        {isCreating && (
          <Stack spacing={1.5}>
            <div>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Permisos
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {permissionCodes.size === 0
                  ? 'Elige qué podrá ver y hacer este rol. Puedes cambiarlos después.'
                  : `${permissionCodes.size} ${permissionCodes.size === 1 ? 'permiso seleccionado' : 'permisos seleccionados'}`}
              </Typography>
            </div>
            <PermissionChecklist checked={permissionCodes} onChange={setPermissionCodes} />
          </Stack>
        )}
      </Stack>
    </FormDrawer>
  );
}
