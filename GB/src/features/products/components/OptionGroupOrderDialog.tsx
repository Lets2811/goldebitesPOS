import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useSetOptionGroupOrder } from '../../../modules/option-groups/hooks/use-option-groups';
import type { OptionGroup } from '../../../modules/option-groups/types/option-group.types';

interface OptionGroupOrderDialogProps {
  open: boolean;
  groups: OptionGroup[];
  onClose: () => void;
}

/** El orden en que aparecen los grupos al elegir: primero "Tamaño", luego "Salsas"... */
export default function OptionGroupOrderDialog({ open, groups, onClose }: OptionGroupOrderDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const setOrder = useSetOptionGroupOrder();
  const [order, setOrderState] = useState(groups);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOrderState(groups);
  }

  const move = (index: number, delta: number) =>
    setOrderState((current) => {
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });

  const save = () =>
    setOrder.mutate(
      order.map((group) => group.id),
      {
        onSuccess: () => {
          enqueueSnackbar('Orden guardado', { variant: 'success' });
          onClose();
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Ordenar grupos</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          En este orden se le preguntan al cliente y se imprimen en la comanda.
        </Typography>
        <Stack spacing={1}>
          {order.map((group, index) => (
            <Stack
              key={group.id}
              direction="row"
              sx={{
                alignItems: 'center',
                px: 1.5,
                py: 0.75,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
                opacity: group.isActive ? 1 : 0.6,
              }}
            >
              <Typography sx={{ flex: 1, fontWeight: 600 }}>
                {index + 1}. {group.name}
                {!group.isActive && ' (apagado)'}
              </Typography>
              <IconButton size="small" aria-label={`Subir ${group.name}`} disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUp size={16} />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`Bajar ${group.name}`}
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={16} />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={setOrder.isPending} onClick={save}>
          Guardar orden
        </Button>
      </DialogActions>
    </Dialog>
  );
}
