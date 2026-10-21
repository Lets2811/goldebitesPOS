import { useState, type FormEvent } from 'react';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useSnackbar } from 'notistack';
import ConfirmDialog from '../../../shared/components/common/ConfirmDialog';
import DetailDrawer from '../../../shared/components/common/DetailDrawer';
import LoadingSkeleton from '../../../shared/components/common/LoadingSkeleton';
import StatusChip from '../../../shared/components/common/StatusChip';
import {
  useBusinessBranchMutations,
  useBusinessBranches,
} from '../../../modules/businesses/hooks/use-business-branches';
import { normalizeApiError } from '../../../shared/lib/api/api-error';
import type { Branch } from '../../../shared/modules/branches/types/branch.types';
import type { BusinessRef } from '../../../modules/businesses/types/platform-admin.types';

interface BusinessBranchesDrawerProps {
  business: BusinessRef | null;
  onClose: () => void;
}

/**
 * The branches of a business, managed by the platform: how many it has is
 * what it has contracted, so its own settings cannot add, rename or remove
 * them. A business with a single active branch works as one place, and its
 * staff need not be assigned to it.
 */
export default function BusinessBranchesDrawer({ business, onClose }: BusinessBranchesDrawerProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { data: branches, isLoading } = useBusinessBranches(business?.id ?? null);
  const { create, update, setStatus, remove } = useBusinessBranchMutations(business?.id ?? '');

  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<Branch | null>(null);

  if (!business) return null;

  const showError = (error: unknown) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' });
  const activeCount = (branches ?? []).filter((branch) => branch.isActive).length;

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (name.length < 2) return;
    create.mutate(
      { name },
      {
        onSuccess: () => {
          enqueueSnackbar('Sede agregada', { variant: 'success' });
          setNewName('');
        },
        onError: showError,
      },
    );
  };

  const handleRename = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (name.length < 2) return;
    update.mutate(
      { branchId: editing.id, name },
      {
        onSuccess: () => {
          enqueueSnackbar('Sede renombrada', { variant: 'success' });
          setEditing(null);
        },
        onError: showError,
      },
    );
  };

  return (
    <>
      <DetailDrawer
        open={Boolean(business)}
        onClose={onClose}
        title={business.name}
        subtitle="Sedes contratadas por esta empresa"
        width={460}
      >
        {isLoading || !branches ? (
          <LoadingSkeleton variant="list" />
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {activeCount === 1
                ? 'Tiene una sede activa: el POS funciona como un solo lugar y su personal no necesita estar asignado a una sede.'
                : `Tiene ${activeCount} sedes activas: cada usuario trabaja en la sede a la que esté asignado.`}
            </Typography>

            <Stack spacing={1.5} divider={<Divider flexItem />}>
              {branches.map((branch) => (
                <Stack key={branch.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  {editing?.id === branch.id ? (
                    <>
                      <TextField
                        size="small"
                        label="Nombre"
                        value={editing.name}
                        autoFocus
                        onChange={(e) => setEditing({ id: branch.id, name: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                        sx={{ flex: 1 }}
                      />
                      <IconButton size="small" aria-label="Guardar nombre" onClick={handleRename} disabled={update.isPending}>
                        <Check size={16} />
                      </IconButton>
                      <IconButton size="small" aria-label="Cancelar" onClick={() => setEditing(null)}>
                        <X size={16} />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {branch.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {branch.tableCount} mesas
                        </Typography>
                      </Box>
                      <StatusChip label={branch.isActive ? 'Activa' : 'Inactiva'} tone={branch.isActive ? 'success' : 'neutral'} />
                      <IconButton
                        size="small"
                        aria-label={`Renombrar ${branch.name}`}
                        onClick={() => setEditing({ id: branch.id, name: branch.name })}
                      >
                        <Pencil size={15} />
                      </IconButton>
                      <Button
                        size="small"
                        onClick={() =>
                          setStatus.mutate(
                            { branchId: branch.id, isActive: !branch.isActive },
                            {
                              onSuccess: () =>
                                enqueueSnackbar(branch.isActive ? 'Sede desactivada' : 'Sede activada', {
                                  variant: 'success',
                                }),
                              onError: showError,
                            },
                          )
                        }
                      >
                        {branch.isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Eliminar ${branch.name}`}
                        onClick={() => setDeleting(branch)}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </>
                  )}
                </Stack>
              ))}
            </Stack>

            <Divider />

            <Stack component="form" direction="row" spacing={1} onSubmit={handleAdd} sx={{ alignItems: 'center' }}>
              <TextField
                size="small"
                label="Nombre de la nueva sede"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                sx={{ flex: 1 }}
              />
              <Button
                type="submit"
                variant="contained"
                startIcon={<Plus size={16} />}
                loading={create.isPending}
                disabled={newName.trim().length < 2}
              >
                Agregar
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              El número de mesas y las etiquetas NFC de cada sede los configura la propia empresa.
            </Typography>
          </Stack>
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar sede"
        description={`¿Eliminar "${deleting?.name}"? Solo se puede eliminar una sede que nunca se usó; si tiene pedidos, personal o inventario, hay que desactivarla.`}
        confirmLabel="Eliminar"
        destructive
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => enqueueSnackbar('Sede eliminada', { variant: 'success' }),
            onError: showError,
            onSettled: () => setDeleting(null),
          });
        }}
      />
    </>
  );
}
