import { useState } from 'react';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import FormDrawer from '../../../components/common/FormDrawer';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useSaveDiscount } from '../../../modules/discounts/hooks/use-discounts';
import type {
  Discount,
  DiscountKind,
  DiscountPayload,
} from '../../../modules/discounts/types/discount.types';

interface DiscountFormDrawerProps {
  open: boolean;
  kind: DiscountKind;
  discount: Discount | null;
  onClose: () => void;
}

interface FormState {
  name: string;
  description: string;
  code: string;
  percent: string;
  startsOn: string;
  endsOn: string;
  maxUses: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  name: '',
  description: '',
  code: '',
  percent: '',
  startsOn: '',
  endsOn: '',
  maxUses: '',
  isActive: true,
};

/** yyyy-mm-dd in the local day, for a date input. */
function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A date input's day, from its first or up to its last second (local time). */
function fromDateInput(value: string, endOfDay: boolean): string | null {
  if (!value) return null;
  return new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`).toISOString();
}

export default function DiscountFormDrawer({
  open,
  kind,
  discount,
  onClose,
}: DiscountFormDrawerProps) {
  const { enqueueSnackbar } = useSnackbar();
  const save = useSaveDiscount();
  // The page remounts this drawer (key) on every open, so the form starts from the discount.
  const [form, setForm] = useState<FormState>(() =>
    discount
      ? {
          name: discount.name,
          description: discount.description ?? '',
          code: discount.code ?? '',
          percent: String(discount.percent),
          startsOn: toDateInput(discount.startsAt),
          endsOn: toDateInput(discount.endsAt),
          maxUses: discount.maxUses ? String(discount.maxUses) : '',
          isActive: discount.isActive,
        }
      : EMPTY,
  );
  const isCoupon = kind === 'COUPON';

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const percent = Number(form.percent.replace(',', '.'));
  const percentValid = percent > 0 && percent <= 100;
  const codeValid = !isCoupon || /^[A-Z0-9_-]{3,30}$/.test(form.code);
  const datesValid = !form.startsOn || !form.endsOn || form.startsOn <= form.endsOn;
  const maxUses = form.maxUses ? Number(form.maxUses) : null;
  const maxUsesValid = maxUses === null || (Number.isInteger(maxUses) && maxUses >= 1);
  const valid = form.name.trim() !== '' && percentValid && codeValid && datesValid && maxUsesValid;

  const submit = () => {
    if (!valid) return;
    const payload: DiscountPayload = {
      kind,
      name: form.name.trim(),
      description: form.description.trim() || null,
      code: isCoupon ? form.code : null,
      percent: Math.round(percent * 100) / 100,
      startsAt: fromDateInput(form.startsOn, false),
      endsAt: fromDateInput(form.endsOn, true),
      maxUses,
      isActive: form.isActive,
    };
    save.mutate(
      { id: discount?.id, payload },
      {
        onSuccess: () => {
          enqueueSnackbar(
            discount ? 'Descuento actualizado' : isCoupon ? 'Cupón creado' : 'Promoción creada',
            {
              variant: 'success',
            },
          );
          onClose();
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );
  };

  const noun = isCoupon ? 'cupón' : 'promoción';

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={discount ? `Editar ${noun}` : isCoupon ? 'Nuevo cupón' : 'Nueva promoción'}
      subtitle={
        isCoupon
          ? 'Se aplica al cobrar escribiendo su código.'
          : 'Para eventos y temporadas: se elige de la lista al cobrar.'
      }
      submitLabel={discount ? 'Guardar cambios' : 'Crear'}
      loading={save.isPending}
      submitDisabled={!valid}
      width={460}
    >
      <Stack spacing={2.5}>
        <TextField
          label="Nombre"
          required
          fullWidth
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder={isCoupon ? 'Ej. Cupón de bienvenida' : 'Ej. Día de la madre'}
          slotProps={{ htmlInput: { maxLength: 100 } }}
        />
        {isCoupon && (
          <TextField
            label="Código"
            required
            fullWidth
            value={form.code}
            onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s/g, ''))}
            placeholder="Ej. VERANO10"
            error={form.code !== '' && !codeValid}
            helperText="De 3 a 30 letras, números, guiones o guiones bajos."
            slotProps={{ htmlInput: { maxLength: 30 } }}
          />
        )}
        <TextField
          label="Porcentaje de descuento"
          required
          fullWidth
          value={form.percent}
          onChange={(e) => set('percent', e.target.value.replace(/[^\d.,]/g, ''))}
          error={form.percent !== '' && !percentValid}
          helperText="Sobre el subtotal del pedido, antes de impuestos y domicilio."
          slotProps={{
            htmlInput: { inputMode: 'decimal' },
            input: { endAdornment: <span>%</span> },
          }}
        />
        <TextField
          label="Descripción"
          fullWidth
          multiline
          minRows={2}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          slotProps={{ htmlInput: { maxLength: 300 } }}
        />
        <div>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Vigencia{' '}
            <Typography component="span" variant="caption" color="text.secondary">
              (opcional)
            </Typography>
          </Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Desde"
              type="date"
              fullWidth
              value={form.startsOn}
              onChange={(e) => set('startsOn', e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Hasta"
              type="date"
              fullWidth
              value={form.endsOn}
              onChange={(e) => set('endsOn', e.target.value)}
              error={!datesValid}
              helperText={!datesValid ? 'Debe ser después de "Desde"' : undefined}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        </div>
        <TextField
          label="Límite de usos"
          fullWidth
          value={form.maxUses}
          onChange={(e) => set('maxUses', e.target.value.replace(/\D/g, ''))}
          error={!maxUsesValid}
          helperText={
            discount
              ? `Vacío: sin límite. Usado ${discount.usedCount} ${discount.usedCount === 1 ? 'vez' : 'veces'}.`
              : 'Vacío: sin límite.'
          }
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        />
        <FormControlLabel
          control={
            <Switch checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
          }
          label="Activo"
        />
      </Stack>
    </FormDrawer>
  );
}
