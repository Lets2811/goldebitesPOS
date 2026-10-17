import { useMemo, useState } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useSnackbar } from 'notistack';
import HrSectionHeader from '../../hr/components/HrSectionHeader';
import FilterBar from '../../../components/common/FilterBar';
import SearchInput from '../../../components/common/SearchInput';
import DataTable from '../../../components/common/DataTable';
import StatusChip from '../../../components/common/StatusChip';
import ErrorState from '../../../components/common/ErrorState';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { Can } from '../../../modules/auth/components/can';
import { useEmployees } from '../../../modules/employees/hooks/use-employees';
import { useCreateEmployee } from '../../../modules/employees/hooks/use-create-employee';
import { useUpdateEmployee } from '../../../modules/employees/hooks/use-update-employee';
import { useDeleteEmployee } from '../../../modules/employees/hooks/use-delete-employee';
import { useRoles } from '../../../modules/roles/hooks/use-roles';
import { getRoleLabel } from '../../../modules/roles/role-labels';
import { normalizeApiError } from '../../../lib/api/api-error';
import {
  EMPLOYEE_DOCUMENT_TYPE_SHORT,
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUS_TONE,
} from '../../../modules/employees/employee-status';
import type { Employee, EmployeeStatus } from '../../../modules/employees/types/employee.types';
import type { EmployeeFormValues } from '../schemas/employeeSchema';
import EmployeeDetailDrawer from '../components/EmployeeDetailDrawer';
import EmployeeFormDrawer from '../components/EmployeeFormDrawer';
import NewAccountInfoDialog from '../components/NewAccountInfoDialog';

export default function EmployeesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EmployeeStatus | 'todos'>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [newAccountEmail, setNewAccountEmail] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      limit: 100,
      search: search || undefined,
      status: status === 'todos' ? undefined : status,
    }),
    [search, status],
  );

  const { data, isLoading, isError, refetch } = useEmployees(filters);
  const { data: roles } = useRoles();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const employees = data?.data ?? [];
  const roleNameById = useMemo(
    () => new Map((roles ?? []).map((role) => [role.id, getRoleLabel(role.name)])),
    [roles],
  );

  const handleSubmit = (values: EmployeeFormValues) => {
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      documentType: values.documentNumber ? values.documentType : undefined,
      documentNumber: values.documentNumber?.trim() || undefined,
      phone: values.phone || undefined,
      email: values.email || undefined,
      roleId: values.roleId,
      branchId: values.branchId || undefined,
      status: values.status,
      hireDate: values.hireDate || undefined,
      notes: values.notes || undefined,
      payRate: values.payRate,
      payFrequency: values.payFrequency,
    };

    if (editingEmployee) {
      updateEmployee.mutate(
        { id: editingEmployee.id, payload },
        {
          onSuccess: () => {
            enqueueSnackbar('Empleado actualizado correctamente', { variant: 'success' });
            setFormOpen(false);
          },
          onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
        },
      );
    } else {
      createEmployee.mutate({ ...payload, createAccess: values.createAccess }, {
        onSuccess: (employee) => {
          enqueueSnackbar('Empleado creado correctamente', { variant: 'success' });
          setFormOpen(false);
          if (employee.userAccount) {
            setNewAccountEmail(employee.userAccount.email);
          }
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      });
    }
  };

  const handleDelete = () => {
    if (!deletingEmployee) return;
    deleteEmployee.mutate(deletingEmployee.id, {
      onSuccess: () => enqueueSnackbar('Empleado eliminado', { variant: 'success' }),
      onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      onSettled: () => setDeletingEmployee(null),
    });
  };

  const columns: ColumnDef<Employee, unknown>[] = [
    {
      id: 'name',
      header: 'Nombre',
      cell: ({ row }) => `${row.original.firstName} ${row.original.lastName}`,
    },
    {
      id: 'document',
      header: 'Documento',
      cell: ({ row }) =>
        row.original.documentNumber
          ? `${row.original.documentType ? EMPLOYEE_DOCUMENT_TYPE_SHORT[row.original.documentType] : ''} ${row.original.documentNumber}`.trim()
          : '—',
    },
    {
      id: 'position',
      header: 'Cargo',
      cell: ({ row }) => (row.original.roleId ? (roleNameById.get(row.original.roleId) ?? '—') : '—'),
    },
    {
      id: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <StatusChip
          label={EMPLOYEE_STATUS_LABELS[row.original.status]}
          tone={EMPLOYEE_STATUS_TONE[row.original.status]}
        />
      ),
    },
    {
      id: 'hireDate',
      header: 'Ingreso',
      cell: ({ row }) =>
        row.original.hireDate ? new Date(row.original.hireDate).toLocaleDateString('es-CO') : '—',
    },
  ];

  return (
    <>
      <HrSectionHeader
        description="Equipo de trabajo y turnos semanales."
        actions={
          <Can permission="employees.manage">
            <Button
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => {
                setEditingEmployee(null);
                setFormOpen(true);
              }}
            >
              Nuevo empleado
            </Button>
          </Can>
        }
      />

      <FilterBar
        onClear={() => {
          setSearch('');
          setStatus('todos');
        }}
        hasActiveFilters={Boolean(search) || status !== 'todos'}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o documento..." />
        <TextField
          select
          size="small"
          label="Estado"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="todos">Todos los estados</MenuItem>
          {Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
      </FilterBar>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={employees}
          isLoading={isLoading}
          onRowClick={(row) => setSelectedId(row.id)}
          emptyTitle="No hay empleados con estos filtros"
          pageSize={10}
        />
      )}

      <EmployeeDetailDrawer
        employeeId={selectedId}
        onClose={() => setSelectedId(null)}
        onEdit={(employee) => {
          setSelectedId(null);
          setEditingEmployee(employee);
          setFormOpen(true);
        }}
        onDelete={(employee) => {
          setSelectedId(null);
          setDeletingEmployee(employee);
        }}
      />

      <EmployeeFormDrawer
        open={formOpen}
        loading={createEmployee.isPending || updateEmployee.isPending}
        initialEmployee={editingEmployee}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deletingEmployee)}
        title="Eliminar empleado"
        description={`¿Seguro que deseas eliminar a "${deletingEmployee?.firstName} ${deletingEmployee?.lastName}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onClose={() => setDeletingEmployee(null)}
        onConfirm={handleDelete}
      />

      <NewAccountInfoDialog
        open={Boolean(newAccountEmail)}
        email={newAccountEmail}
        onClose={() => setNewAccountEmail(null)}
      />
    </>
  );
}
