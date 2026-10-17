import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useCreateOptionGroup } from '../../../modules/option-groups/hooks/use-option-groups';
import type { OptionGroup } from '../../../modules/option-groups/types/option-group.types';

interface NewOptionGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (group: OptionGroup) => void;
}

/** Un grupo nuevo de opciones para elegir: "Tamaño", "Mezcladores", "Término de la carne"... */
export default function NewOptionGroupDialog({ open, onClose, onCreated }: NewOptionGroupDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const create = useCreateOptionGroup();
  const [name, setName] = useState('');
  const [singularName, setSingularName] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  // Cada vez que se abre, empieza en blanco.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName('');
      setSingularName('');
      setIsRequired(false);
    }
  }

  const valid = name.trim().length > 0 && singularName.trim().length > 0;

  const submit = () =>
    create.mutate(
      { name: name.trim(), singularName: singularName.trim(), isRequired },
      {
        onSuccess: (group) => {
          enqueueSnackbar(`Grupo "${group.name}" creado`, { variant: 'success' });
          onCreated(group);
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Nuevo grupo de opciones</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Algo que el cliente elige en algunos productos. Después le agregas sus opciones y lo activas en cada
          producto.
        </Typography>
        <Stack spacing={2}>
          <TextField
            autoFocus
            label="Nombre (plural)"
            placeholder="Ej. Mezcladores, Tamaño"
            value={name}
            onChange={(e) => setName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 40 } }}
          />
          <TextField
            label="Nombre (singular)"
            placeholder="Ej. Mezclador, Tamaño"
            value={singularName}
            onChange={(e) => setSingularName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 40 } }}
          />
          <FormControlLabel
            control={<Switch checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />}
            label="Obligatorio: hay que elegir al menos una opción"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={!valid || create.isPending} onClick={submit}>
          Crear grupo
        </Button>
      </DialogActions>
    </Dialog>
  );
}
