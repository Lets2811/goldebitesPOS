import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import FormDrawer from '../../../components/common/FormDrawer';
import { supplierSchema, type SupplierFormValues } from '../schemas/supplierSchema';
import type { Supplier } from '../../../modules/suppliers/types/supplier.types';

interface SupplierFormDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: SupplierFormValues) => void;
  initialSupplier?: Supplier | null;
}

const emptyValues: SupplierFormValues = {
  name: '',
  taxId: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
  creditDays: '',
};

export default function SupplierFormDrawer({
  open,
  onClose,
  onSubmit,
  initialSupplier,
}: SupplierFormDrawerProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (open) {
      reset(
        initialSupplier
          ? {
              name: initialSupplier.name,
              taxId: initialSupplier.taxId ?? '',
              contactName: initialSupplier.contactName ?? '',
              email: initialSupplier.email ?? '',
              phone: initialSupplier.phone ?? '',
              address: initialSupplier.address ?? '',
              notes: initialSupplier.notes ?? '',
              creditDays: initialSupplier.creditDays != null ? String(initialSupplier.creditDays) : '',
            }
          : emptyValues,
      );
    }
  }, [open, initialSupplier, reset]);

  const submit = handleSubmit((values) => onSubmit(values));

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={initialSupplier ? 'Editar proveedor' : 'Nuevo proveedor'}
      submitLabel={initialSupplier ? 'Guardar cambios' : 'Crear proveedor'}
      loading={isSubmitting}
      width={460}
    >
      <Stack spacing={2.5}>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Nombre del proveedor"
              fullWidth
              error={Boolean(errors.name)}
              helperText={errors.name?.message}
            />
          )}
        />

        <Stack direction="row" spacing={2}>
          <Controller
            name="taxId"
            control={control}
            render={({ field }) => <TextField {...field} label="NIT" fullWidth />}
          />
          <Controller
            name="contactName"
            control={control}
            render={({ field }) => <TextField {...field} label="Persona de contacto" fullWidth />}
          />
        </Stack>

        <Stack direction="row" spacing={2}>
          <Controller
            name="phone"
            control={control}
            render={({ field }) => <TextField {...field} label="Teléfono" fullWidth />}
          />
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Correo electrónico"
                fullWidth
                error={Boolean(errors.email)}
                helperText={errors.email?.message}
              />
            )}
          />
        </Stack>

        <Controller
          name="address"
          control={control}
          render={({ field }) => <TextField {...field} label="Dirección" fullWidth />}
        />

        <Controller
          name="creditDays"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Días de crédito"
              inputMode="numeric"
              fullWidth
              error={Boolean(errors.creditDays)}
              helperText={
                errors.creditDays?.message ?? 'Plazo que da para pagar. Propone el vencimiento de las compras a crédito.'
              }
            />
          )}
        />

        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <TextField {...field} label="Notas" multiline minRows={2} fullWidth />
          )}
        />
      </Stack>
    </FormDrawer>
  );
}
