import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { createBusinessSchema, type CreateBusinessFormValues } from '../schemas/createBusinessSchema';

interface CreateBusinessDialogProps {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: CreateBusinessFormValues) => void;
}

const emptyValues: CreateBusinessFormValues = {
  name: '',
  currency: 'COP',
  timezone: 'America/Bogota',
  ownerFirstName: '',
  ownerLastName: '',
  ownerEmail: '',
  ownerPassword: '',
};

export default function CreateBusinessDialog({ open, loading, onClose, onSubmit }: CreateBusinessDialogProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBusinessFormValues>({
    resolver: zodResolver(createBusinessSchema),
    defaultValues: emptyValues,
  });

  const submit = handleSubmit((values) => onSubmit(values));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ transition: { onExited: () => reset(emptyValues) } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Nueva empresa</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 0.5 }}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nombre de la empresa"
                fullWidth
                error={Boolean(errors.name)}
                helperText={errors.name?.message}
              />
            )}
          />
          <Stack direction="row" spacing={2}>
            <Controller
              name="currency"
              control={control}
              render={({ field }) => <TextField {...field} label="Moneda (ISO 4217)" fullWidth />}
            />
            <Controller
              name="timezone"
              control={control}
              render={({ field }) => <TextField {...field} label="Zona horaria" fullWidth />}
            />
          </Stack>

          <Divider />
          <Typography variant="caption" color="text.secondary">
            Usuario propietario inicial
          </Typography>

          <Stack direction="row" spacing={2}>
            <Controller
              name="ownerFirstName"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Nombre"
                  fullWidth
                  error={Boolean(errors.ownerFirstName)}
                  helperText={errors.ownerFirstName?.message}
                />
              )}
            />
            <Controller
              name="ownerLastName"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Apellido"
                  fullWidth
                  error={Boolean(errors.ownerLastName)}
                  helperText={errors.ownerLastName?.message}
                />
              )}
            />
          </Stack>
          <Controller
            name="ownerEmail"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Correo de acceso"
                fullWidth
                error={Boolean(errors.ownerEmail)}
                helperText={errors.ownerEmail?.message}
              />
            )}
          />
          <Controller
            name="ownerPassword"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Contraseña temporal"
                type="password"
                fullWidth
                error={Boolean(errors.ownerPassword)}
                helperText={errors.ownerPassword?.message}
              />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={submit} loading={loading}>
          Crear empresa
        </Button>
      </DialogActions>
    </Dialog>
  );
}
