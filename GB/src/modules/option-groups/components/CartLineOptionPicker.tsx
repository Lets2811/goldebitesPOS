import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useOptionGroups } from '../hooks/use-option-groups';
import type { ProductOptionGroup } from '../types/option-group.types';
import { offeredGroups, optionCaption } from '../utils/option-group-utils';

interface CartLineOptionPickerProps {
  line: { optionGroups: ProductOptionGroup[]; optionItemIds: string[] };
  onToggle: (groupId: string, itemId: string) => void;
  /** Más grande y táctil, para los kioscos. */
  large?: boolean;
}

/** Un selector por cada grupo que ofrece el producto de la línea: "Salsas (máx. 2)" con sus opciones. */
export default function CartLineOptionPicker({ line, onToggle, large }: CartLineOptionPickerProps) {
  const { groups } = useOptionGroups();

  return (
    <>
      {offeredGroups(line, groups).map(({ group, maxChoices }) => {
        const active = group.items.filter((item) => item.isActive);
        const pickedInGroup = active.filter((item) => line.optionItemIds.includes(item.id)).length;
        return (
          <Box key={group.id} sx={{ mt: large ? 1 : 0.75 }}>
            <Typography
              variant="caption"
              color={group.isRequired && pickedInGroup === 0 ? 'warning.main' : 'text.secondary'}
              sx={{ fontWeight: large ? 700 : undefined }}
            >
              {optionCaption(group, maxChoices)}
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ mt: large ? 0.5 : 0.25, flexWrap: 'wrap' }}>
              {active.map((item) => {
                const selected = line.optionItemIds.includes(item.id);
                // Con máximo 1 se puede tocar otra para cambiarla.
                const disabled = !selected && maxChoices > 1 && pickedInGroup >= maxChoices;
                return (
                  <Chip
                    key={item.id}
                    label={item.name}
                    size={large ? 'medium' : 'small'}
                    clickable={!disabled}
                    disabled={disabled}
                    onClick={() => onToggle(group.id, item.id)}
                    color={selected ? 'primary' : 'default'}
                    variant={selected ? 'filled' : 'outlined'}
                    sx={{ fontWeight: large ? 700 : 600 }}
                  />
                );
              })}
            </Stack>
          </Box>
        );
      })}
    </>
  );
}
