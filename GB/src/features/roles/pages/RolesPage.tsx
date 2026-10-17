import { useState } from 'react';
import Button from '@mui/material/Button';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useSnackbar } from 'notistack';
import HrSectionHeader from '../../hr/components/HrSectionHeader';
import DataTable from '../../../components/common/DataTable';
import ErrorState from '../../../components/common/ErrorState';
import { Can } from '../../../modules/auth/components/can';
import { useRoles } from '../../../modules/roles/hooks/use-roles';
import { useCreateRole } from '../../../modules/roles/hooks/use-create-role';
import { useUpdateRole } from '../../../modules/roles/hooks/use-update-role';
import { normalizeApiError } from '../../../lib/api/api-error';
import { getRoleLabel } from '../../../modules/roles/role-labels';
import type { Role } from '../../../modules/roles/types/role.types';
import type { RoleFormValues } from '../schemas/roleSchema';
import RoleFormDrawer from '../components/RoleFormDrawer';
import RolePermissionsDrawer from '../components/RolePermissionsDrawer';

export default function RolesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { data: roles, isLoading, isError, refetch } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const handleSubmit = (values: RoleFormValues, permissionCodes?: string[]) => {
    if (editingRole) {
      updateRole.mutate(
        { id: editingRole.id, payload: values },
        {
          onSuccess: () => {
            enqueueSnackbar('Rol actualizado correctamente', { variant: 'success' });
            setFormOpen(false);
          },
          onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
        },
      );
    } else {
      createRole.mutate({ ...values, permissionCodes }, {
        onSuccess: () => {
          enqueueSnackbar('Rol creado correctamente', { variant: 'success' });
          setFormOpen(false);
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      });
    }
  };

  const columns: ColumnDef<Role, unknown>[] = [
    { id: 'name', header: 'Rol', cell: ({ row }) => getRoleLabel(row.original.name) },
    { id: 'description', header: 'Descripción', cell: ({ row }) => row.original.description ?? '—' },
  ];

  return (
    <>
      <HrSectionHeader
        description="Crea roles con su descripción y controla qué puede ver y hacer cada uno. Cada empleado ve la descripción de su rol en su perfil."
        actions={
          <Can permission="roles.manage">
            <Button
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => {
                setEditingRole(null);
                setFormOpen(true);
              }}
            >
              Nuevo rol
            </Button>
          </Can>
        }
      />

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={roles ?? []}
          isLoading={isLoading}
          onRowClick={(row) => setSelectedRoleId(row.id)}
          emptyTitle="Aún no hay roles personalizados"
          pageSize={15}
        />
      )}

      <RolePermissionsDrawer
        roleId={selectedRoleId}
        onClose={() => setSelectedRoleId(null)}
        onEdit={() => {
          const role = roles?.find((r) => r.id === selectedRoleId);
          if (!role) return;
          setSelectedRoleId(null);
          setEditingRole(role);
          setFormOpen(true);
        }}
      />

      <RoleFormDrawer
        open={formOpen}
        loading={createRole.isPending || updateRole.isPending}
        initialRole={editingRole}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
}
