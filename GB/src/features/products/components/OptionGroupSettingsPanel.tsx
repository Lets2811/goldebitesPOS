import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Settings2 } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { normalizeApiError } from '../../../lib/api/api-error';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import { useUpdateOptionGroup } from '../../../modules/option-groups/hooks/use-option-groups';
import type { OptionGroup } from '../../../modules/option-groups/types/option-group.types';
import { isFeminineLabel } from '../../../modules/option-groups/utils/option-group-utils';
import { brand } from '../../../theme/palette';

interface GroupForm {
  name: string;
  singularName: string;
  isActive: boolean;
  isRequired: boolean;
  defaultMax: number;
}

const toForm = (group: OptionGroup): GroupForm => ({
  name: group.name,
  singularName: group.singularName,
  isActive: group.isActive,
  isRequired: group.isRequired,
  defaultMax: group.defaultMax,
});

/** El nombre y las reglas de un grupo de opciones: "Salsas", obligatoria o no, cuántas por defecto... */
export default function OptionGroupSettingsPanel({ group }: { group: OptionGroup }) {
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('products.update');
  const update = useUpdateOptionGroup();
  const [form, setForm] = useState(() => toForm(group));
  // Si cambia en el servidor (otra pestaña, otro usuario), el formulario lo sigue.
  const [tracked, setTracked] = useState(group);
  if (tracked !== group) {
    setTracked(group);
    setForm(toForm(group));
  }

  const name = form.name.trim();
  const singularName = form.singularName.trim();
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(group));
  const valid = name.length > 0 && singularName.length > 0;
  const set = <K extends keyof GroupForm>(key: K, value: GroupForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = () =>
    update.mutate(
      { id: group.id, payload: { ...form, name, singularName } },
      {
        onSuccess: () => enqueueSnackbar(`"${name}" guardado`, { variant: 'success' }),
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 0.5 }}>
        <Settings2 size={18} color={brand.gold} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Cómo funciona este grupo
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Así aparece en el punto de venta, la cocina, los tickets y el menú del cliente. Cada producto elige si lo
        ofrece y cuántas opciones se pueden escoger.
      </Typography>

      <FormControlLabel
        control={
          <Switch checked={form.isActive} disabled={!canEdit} onChange={(e) => set('isActive', e.target.checked)} />
        }
        label={form.isActive ? 'Activo: los productos pueden ofrecerlo' : 'Apagado: no aparece en ningún lado'}
        sx={{ mb: 1.5 }}
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
          opacity: form.isActive ? 1 : 0.55,
        }}
      >
        <TextField
          label="Nombre (plural)"
          value={form.name}
          disabled={!canEdit}
          onChange={(e) => set('name', e.target.value)}
          error={name.length === 0}
          helperText={name.length === 0 ? 'Obligatorio' : 'Ej. Salsas, Mezcladores, Tamaño'}
          slotProps={{ htmlInput: { maxLength: 40 } }}
        />
        <TextField
          label="Nombre (singular)"
          value={form.singularName}
          disabled={!canEdit}
          onChange={(e) => set('singularName', e.target.value)}
          error={singularName.length === 0}
          helperText={singularName.length === 0 ? 'Obligatorio' : 'Ej. Salsa, Mezclador, Tamaño'}
          slotProps={{ htmlInput: { maxLength: 40 } }}
        />
        <TextField
          label="Máximo sugerido"
          type="number"
          value={form.defaultMax}
          disabled={!canEdit}
          onChange={(e) => set('defaultMax', Math.max(1, Math.min(20, Math.trunc(Number(e.target.value) || 1))))}
          helperText="Con el que arranca un producto al ofrecerlo"
          slotProps={{ htmlInput: { min: 1, max: 20 } }}
        />
      </Box>

      <FormControlLabel
        control={
          <Switch
            checked={form.isRequired}
            disabled={!canEdit || !form.isActive}
            onChange={(e) => set('isRequired', e.target.checked)}
          />
        }
        label={`Obligatorio: el cliente debe elegir al menos ${isFeminineLabel(singularName) ? 'una' : 'un'} ${
          singularName.toLocaleLowerCase('es') || 'opción'
        } en los productos que lo ofrecen`}
        sx={{ mt: 1.5, display: 'flex' }}
      />

      {canEdit && (
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 1.5 }}>
          <Button disabled={!dirty || update.isPending} onClick={() => setForm(toForm(group))}>
            Descartar
          </Button>
          <Button variant="contained" disabled={!dirty || !valid || update.isPending} onClick={save}>
            Guardar
          </Button>
        </Stack>
      )}
    </Paper>
  );
}
