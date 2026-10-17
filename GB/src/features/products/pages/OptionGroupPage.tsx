import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@mui/material/Button';
import { Power, Trash2 } from 'lucide-react';
import { useSnackbar } from 'notistack';
import PageHeader from '../../../components/common/PageHeader';
import ErrorState from '../../../components/common/ErrorState';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { Can } from '../../../modules/auth/components/can';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import { normalizeApiError } from '../../../lib/api/api-error';
import {
  useCreateOptionItem,
  useDeleteOptionGroup,
  useDeleteOptionItem,
  useOptionGroups,
  useUpdateOptionGroup,
  useUpdateOptionItem,
} from '../../../modules/option-groups/hooks/use-option-groups';
import { isFeminineLabel } from '../../../modules/option-groups/utils/option-group-utils';
import { MODULE_PATHS } from '../../../routes/navConfig';
import OptionGroupSettingsPanel from '../components/OptionGroupSettingsPanel';
import SimpleCatalogManager from '../components/SimpleCatalogManager';

/** Un grupo de opciones ("Salsas", "Mezcladores"...): su nombre y reglas, y la lista de lo que se puede elegir. */
export default function OptionGroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { enqueueSnackbar } = useSnackbar();
  const { groups, isLoading, isError, refetch } = useOptionGroups();
  const createItem = useCreateOptionItem();
  const updateItem = useUpdateOptionItem();
  const deleteItem = useDeleteOptionItem();
  const updateGroup = useUpdateOptionGroup();
  const deleteGroup = useDeleteOptionGroup();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const group = groups.find((g) => g.id === groupId);
  const backTo = { label: 'Productos y recetas', path: MODULE_PATHS.products };

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !group) {
    return (
      <>
        <PageHeader title="Grupo de opciones" backTo={backTo} />
        <ErrorState
          title={isError ? undefined : 'Este grupo no existe'}
          onRetry={() => refetch()}
        />
      </>
    );
  }

  const feminine = isFeminineLabel(group.singularName);
  const onError = (error: unknown) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' });

  const toggleGroup = () =>
    updateGroup.mutate(
      { id: group.id, payload: { isActive: !group.isActive } },
      {
        onSuccess: () =>
          enqueueSnackbar(group.isActive ? `"${group.name}" desactivado` : `"${group.name}" activado`, {
            variant: 'success',
          }),
        onError,
      },
    );

  const removeGroup = () =>
    deleteGroup.mutate(group.id, {
      onSuccess: () => {
        enqueueSnackbar(`Grupo "${group.name}" eliminado`, { variant: 'success' });
        navigate(MODULE_PATHS.products);
      },
      onError,
    });

  const itemsLabel =
    group.items.length === 0
      ? 'nada más (no tiene opciones)'
      : group.items.length === 1
        ? 'su única opción'
        : `sus ${group.items.length} opciones`;
  const offeredBy =
    group.productCount === 0
      ? 'Ningún producto lo ofrece.'
      : `${group.productCount} ${group.productCount === 1 ? 'producto deja' : 'productos dejan'} de ofrecerlo.`;

  return (
    <>
      <PageHeader
        title={group.name}
        subtitle={`Lo que el cliente puede elegir como "${group.name.toLocaleLowerCase('es')}" en los productos que lo ofrecen.`}
        backTo={backTo}
        actions={
          <Can permission="products.update">
            <Button
              variant="outlined"
              color={group.isActive ? 'warning' : 'success'}
              startIcon={<Power size={16} />}
              disabled={updateGroup.isPending}
              onClick={toggleGroup}
            >
              {group.isActive ? 'Desactivar grupo' : 'Activar grupo'}
            </Button>
            <Button variant="outlined" color="error" startIcon={<Trash2 size={16} />} onClick={() => setConfirmDelete(true)}>
              Eliminar grupo
            </Button>
          </Can>
        }
      />
      <ConfirmDialog
        open={confirmDelete}
        title={`¿Eliminar el grupo "${group.name}"?`}
        description={`Se eliminan para siempre el grupo y ${itemsLabel}. ${offeredBy} Los pedidos ya hechos no cambian. Si solo quieres dejar de usarlo por un tiempo, usa "Desactivar grupo".`}
        confirmLabel="Eliminar grupo"
        destructive
        loading={deleteGroup.isPending}
        onConfirm={removeGroup}
        onClose={() => setConfirmDelete(false)}
      />
      <OptionGroupSettingsPanel group={group} />
      <SimpleCatalogManager
        entityLabel={group.singularName.toLocaleLowerCase('es')}
        entityLabelPlural={group.name.toLocaleLowerCase('es')}
        gender={feminine ? 'f' : 'm'}
        items={group.items}
        isLoading={false}
        isError={false}
        onRetry={() => refetch()}
        creating={createItem.isPending}
        updating={updateItem.isPending}
        onCreate={(values, onSuccess) =>
          createItem.mutate({ groupId: group.id, payload: values }, { onSuccess, onError })
        }
        onUpdate={(id, values, onSuccess) =>
          updateItem.mutate({ groupId: group.id, id, payload: values }, { onSuccess, onError })
        }
        deleting={deleteItem.isPending}
        deleteHint="Los pedidos ya hechos la conservan."
        onDelete={(item, onDone) =>
          deleteItem.mutate(
            { groupId: group.id, id: item.id },
            {
              onSuccess: () => {
                enqueueSnackbar(`"${item.name}" eliminad${feminine ? 'a' : 'o'}`, { variant: 'success' });
                onDone();
              },
              onError,
            },
          )
        }
        onToggleStatus={(item) =>
          updateItem.mutate(
            { groupId: group.id, id: item.id, payload: { isActive: !item.isActive } },
            {
              onSuccess: (updated) =>
                enqueueSnackbar(
                  `${updated.name} ${updated.isActive ? 'activad' : 'desactivad'}${feminine ? 'a' : 'o'}`,
                  { variant: 'success' },
                ),
              onError,
            },
          )
        }
      />
    </>
  );
}
