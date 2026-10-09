import { useMemo, useState } from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import { alpha } from '@mui/material/styles';
import { Wrench, Plus } from 'lucide-react';
import { useSnackbar } from 'notistack';
import PageHeader from '../../../components/common/PageHeader';
import FilterBar from '../../../components/common/FilterBar';
import SearchInput from '../../../components/common/SearchInput';
import DateDisplay from '../../../components/common/DateDisplay';
import StatusChip from '../../../components/common/StatusChip';
import ErrorState from '../../../components/common/ErrorState';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { Can } from '../../../modules/auth/components/can';
import { brand } from '../../../theme/palette';
import { useEquipmentList } from '../../../modules/maintenance/hooks/use-equipment-list';
import { useCreateEquipment } from '../../../modules/maintenance/hooks/use-create-equipment';
import { useUpdateEquipment } from '../../../modules/maintenance/hooks/use-update-equipment';
import { useDeleteEquipment } from '../../../modules/maintenance/hooks/use-delete-equipment';
import { normalizeApiError } from '../../../lib/api/api-error';
import { EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUS_TONE } from '../../../modules/maintenance/equipment-status';
import type { Equipment, EquipmentStatus } from '../../../modules/maintenance/types/maintenance.types';
import type { EquipmentFormValues } from '../schemas/equipmentSchema';
import EquipmentDetailDrawer from '../components/EquipmentDetailDrawer';
import EquipmentFormDrawer from '../components/EquipmentFormDrawer';

export default function MaintenancePage() {
  const { enqueueSnackbar } = useSnackbar();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EquipmentStatus | 'todos'>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [deletingEquipment, setDeletingEquipment] = useState<Equipment | null>(null);
  const [now] = useState(() => Date.now());

  const filters = useMemo(
    () => ({
      limit: 100,
      search: search || undefined,
      status: status === 'todos' ? undefined : status,
    }),
    [search, status],
  );

  const { data, isLoading, isError, refetch } = useEquipmentList(filters);
  const createEquipment = useCreateEquipment();
  const updateEquipment = useUpdateEquipment();
  const deleteEquipment = useDeleteEquipment();

  const equipment = data?.data ?? [];

  const handleSubmit = (values: EquipmentFormValues) => {
    const payload = {
      name: values.name,
      serialNumber: values.serialNumber || undefined,
      purchaseDate: values.purchaseDate || undefined,
      warrantyUntil: values.warrantyUntil || undefined,
      technicalSupplier: values.technicalSupplier || undefined,
      nextMaintenanceAt: values.nextMaintenanceAt || undefined,
      notes: values.notes || undefined,
    };

    if (editingEquipment) {
      updateEquipment.mutate(
        { id: editingEquipment.id, payload },
        {
          onSuccess: () => {
            enqueueSnackbar('Equipo actualizado correctamente', { variant: 'success' });
            setFormOpen(false);
          },
          onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
        },
      );
    } else {
      createEquipment.mutate(payload, {
        onSuccess: () => {
          enqueueSnackbar('Equipo creado correctamente', { variant: 'success' });
          setFormOpen(false);
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      });
    }
  };

  const handleDelete = () => {
    if (!deletingEquipment) return;
    deleteEquipment.mutate(deletingEquipment.id, {
      onSuccess: () => enqueueSnackbar('Equipo eliminado', { variant: 'success' }),
      onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      onSettled: () => setDeletingEquipment(null),
    });
  };

  return (
    <>
      <PageHeader
        title="Equipos"
        subtitle="Control de equipos, garantías e intervenciones técnicas."
        breadcrumbs={[{ label: 'Equipos' }]}
        actions={
          <Can permission="maintenance.manage">
            <Button
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => {
                setEditingEquipment(null);
                setFormOpen(true);
              }}
            >
              Nuevo equipo
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
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar equipo..." />
        <TextField
          select
          size="small"
          label="Estado"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="todos">Todos los estados</MenuItem>
          {Object.entries(EQUIPMENT_STATUS_LABELS).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
      </FilterBar>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <Grid container spacing={2}>
          {!isLoading && equipment.length === 0 && (
            <Grid size={12}>
              <Typography variant="body2" color="text.secondary">
                No hay equipos registrados con estos filtros.
              </Typography>
            </Grid>
          )}
          {equipment.map((eq) => {
            const overdue = eq.nextMaintenanceAt ? new Date(eq.nextMaintenanceAt).getTime() < now : false;
            return (
              <Grid key={eq.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <Card sx={{ height: '100%' }}>
                  <CardActionArea onClick={() => setSelectedId(eq.id)} sx={{ height: '100%' }}>
                    <CardContent>
                      <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: alpha(brand.gold, 0.12),
                            color: brand.gold,
                          }}
                        >
                          <Wrench size={18} />
                        </Box>
                        <StatusChip label={EQUIPMENT_STATUS_LABELS[eq.status]} tone={EQUIPMENT_STATUS_TONE[eq.status]} />
                      </Stack>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1.5 }}>
                        {eq.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {eq.serialNumber ?? 'Sin serial'}
                      </Typography>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Próximo mant.
                        </Typography>
                        {eq.nextMaintenanceAt ? (
                          <DateDisplay
                            value={eq.nextMaintenanceAt}
                            variant="caption"
                            color={overdue ? 'error.main' : undefined}
                            sx={{ fontWeight: 700 }}
                          />
                        ) : (
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            —
                          </Typography>
                        )}
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <EquipmentDetailDrawer
        equipmentId={selectedId}
        onClose={() => setSelectedId(null)}
        onEdit={(eq) => {
          setSelectedId(null);
          setEditingEquipment(eq);
          setFormOpen(true);
        }}
        onDelete={(eq) => {
          setSelectedId(null);
          setDeletingEquipment(eq);
        }}
      />

      <EquipmentFormDrawer
        open={formOpen}
        loading={createEquipment.isPending || updateEquipment.isPending}
        initialEquipment={editingEquipment}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deletingEquipment)}
        title="Eliminar equipo"
        description={`¿Seguro que deseas eliminar "${deletingEquipment?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onClose={() => setDeletingEquipment(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}
