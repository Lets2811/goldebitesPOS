import { useState } from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Sparkles } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useCurrentBusiness } from '../../../modules/businesses/hooks/use-current-business';
import {
  DEFAULT_COMBO_BUILDER_DESCRIPTION,
  DEFAULT_COMBO_BUILDER_NAME,
  useUpdateComboBuilder,
} from '../../../modules/products/combo-builder';
import { brand } from '../../../theme/palette';

/**
 * How customers see "Arma tu combo": its name and the line under it, the
 * business's own or the defaults (left empty).
 */
export default function ComboBuilderNameCard({ canEdit }: { canEdit: boolean }) {
  const { enqueueSnackbar } = useSnackbar();
  const { data: business } = useCurrentBusiness();
  const update = useUpdateComboBuilder();
  const savedName = business?.comboBuilderName ?? '';
  const savedDescription = business?.comboBuilderDescription ?? '';
  const [name, setName] = useState(savedName);
  const [description, setDescription] = useState(savedDescription);
  // Re-seed once the business loads (derived during render, not an effect).
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (business && business.id !== seededFor) {
    setSeededFor(business.id);
    setName(savedName);
    setDescription(savedDescription);
  }

  const changed = name.trim() !== savedName || description.trim() !== savedDescription;
  const isCustom = savedName !== '' || savedDescription !== '';

  const save = (nextName: string, nextDescription: string, done: string) =>
    update.mutate(
      { name: nextName.trim() || null, description: nextDescription.trim() || null },
      {
        onSuccess: () => enqueueSnackbar(done, { variant: 'success' }),
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );

  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
        <Sparkles size={17} color={brand.gold} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Cómo lo ve el cliente
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Ponle el nombre que quieras. Si lo dejas vacío se llama «{DEFAULT_COMBO_BUILDER_NAME}».
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'flex-start' } }}>
        <TextField
          size="small"
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={DEFAULT_COMBO_BUILDER_NAME}
          disabled={!canEdit}
          helperText={`${name.length}/40`}
          slotProps={{ htmlInput: { maxLength: 40 } }}
          sx={{ flex: 1 }}
        />
        <TextField
          size="small"
          label="Frase debajo del nombre"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={DEFAULT_COMBO_BUILDER_DESCRIPTION}
          disabled={!canEdit}
          helperText={`${description.length}/120`}
          slotProps={{ htmlInput: { maxLength: 120 } }}
          sx={{ flex: 2 }}
        />
        {canEdit && (
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button
              variant="contained"
              disabled={!changed}
              loading={update.isPending}
              onClick={() => save(name, description, 'Nombre guardado')}
              sx={{ height: 40 }}
            >
              Guardar
            </Button>
            {isCustom && (
              <Button
                disabled={update.isPending}
                onClick={() => {
                  setName('');
                  setDescription('');
                  save('', '', `Volvió a «${DEFAULT_COMBO_BUILDER_NAME}»`);
                }}
                sx={{ height: 40 }}
              >
                Restaurar
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
