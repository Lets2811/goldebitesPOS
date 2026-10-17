import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useOptionGroups } from '../../../modules/option-groups/hooks/use-option-groups';
import type { ProductOptionGroup } from '../../../modules/option-groups/types/option-group.types';

interface ProductOptionGroupsFieldProps {
  value: ProductOptionGroup[];
  onChange: (value: ProductOptionGroup[]) => void;
}

/**
 * Qué grupos de opciones ofrece el producto ("Salsas", "Tamaño"...) y
 * cuántas de cada uno se eligen. Un grupo apagado no se muestra, pero si el
 * producto lo tenía lo conserva, por si el negocio lo vuelve a activar.
 */
export default function ProductOptionGroupsField({ value, onChange }: ProductOptionGroupsFieldProps) {
  const { groups } = useOptionGroups();
  const active = groups.filter((group) => group.isActive);
  const maxOf = (groupId: string) => value.find((o) => o.groupId === groupId)?.maxChoices;

  const toggle = (groupId: string, defaultMax: number, checked: boolean) =>
    onChange(
      checked
        ? [...value, { groupId, maxChoices: defaultMax }]
        : value.filter((o) => o.groupId !== groupId),
    );
  const setMax = (groupId: string, maxChoices: number) =>
    onChange(value.map((o) => (o.groupId === groupId ? { ...o, maxChoices } : o)));

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        Opciones para elegir
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {active.length > 0
          ? 'Marca lo que el cliente puede escoger en este producto y cuántas opciones de cada grupo.'
          : 'Este negocio no tiene grupos de opciones activos. Créalos en Productos y recetas → Opciones para elegir.'}
      </Typography>
      <Stack spacing={1}>
        {active.map((group) => {
          const max = maxOf(group.id);
          const offered = max !== undefined;
          return (
            <Stack key={group.id} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <FormControlLabel
                sx={{ flex: 1, mr: 0 }}
                control={
                  <Checkbox
                    checked={offered}
                    onChange={(e) => toggle(group.id, group.defaultMax, e.target.checked)}
                  />
                }
                label={
                  <span>
                    {group.name}
                    {group.isRequired && (
                      <Typography component="span" variant="caption" color="text.secondary">
                        {' '}
                        · obligatorio
                      </Typography>
                    )}
                  </span>
                }
              />
              <TextField
                label="Máx."
                type="number"
                size="small"
                disabled={!offered}
                value={max ?? group.defaultMax}
                onChange={(e) =>
                  setMax(group.id, Math.max(1, Math.min(20, Math.trunc(Number(e.target.value) || 1))))
                }
                slotProps={{ htmlInput: { min: 1, max: 20, 'aria-label': `Máximo de ${group.name}` } }}
                sx={{ width: 90 }}
              />
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}
