import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { BadgePercent } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { normalizeApiError } from '../../../lib/api/api-error';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import { useCurrentBusiness } from '../../../modules/businesses/hooks/use-current-business';
import {
  useApplyOrderDiscount,
  useAvailablePromotions,
} from '../../../modules/discounts/hooks/use-discounts';
import type { ApplyDiscountPayload } from '../../../modules/discounts/types/discount.types';
import type { Order } from '../../../modules/orders/types/order.types';
import { formatCOP } from '../../../utils/format';

type Mode = 'PROMOTION' | 'COUPON' | 'MANUAL';

/**
 * El descuento del pedido, opcional, antes de cobrar: una promoción de la
 * lista, un cupón por su código o un porcentaje manual (5 → el total menos
 * el 5%). Uno por pedido. Solo mientras no haya pagos registrados.
 */
export default function OrderDiscountSection({
  order,
  amountPaid,
}: {
  order: Order;
  amountPaid: number;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { hasFeature, hasPermission } = usePermissions();
  const { data: business } = useCurrentBusiness();
  // Once there are payments the discount is fixed; the totals already show it.
  const editable =
    hasFeature('discounts') &&
    business?.discountsAtCheckout === true &&
    hasPermission('discounts.apply') &&
    order.status !== 'CANCELLED' &&
    order.subtotal > 0 &&
    amountPaid === 0;
  const { data: promotions = [] } = useAvailablePromotions(editable);
  const apply = useApplyOrderDiscount();
  const [mode, setMode] = useState<Mode>('PROMOTION');
  const [promotionId, setPromotionId] = useState('');
  const [code, setCode] = useState('');
  const [percent, setPercent] = useState('');

  if (!editable) return null;

  const hasDiscount = order.discountAmount > 0;
  const percentValue = Number(percent.replace(',', '.'));
  const payload: ApplyDiscountPayload | null =
    mode === 'PROMOTION'
      ? promotionId
        ? { source: 'PROMOTION', discountId: promotionId }
        : null
      : mode === 'COUPON'
        ? code.trim()
          ? { source: 'COUPON', code: code.trim() }
          : null
        : percentValue > 0 && percentValue <= 100
          ? { source: 'MANUAL', percent: Math.round(percentValue * 100) / 100 }
          : null;

  const run = (next: ApplyDiscountPayload, done: string) =>
    apply.mutate(
      { orderId: order.id, payload: next },
      {
        onSuccess: () => {
          enqueueSnackbar(done, { variant: 'success' });
          setPromotionId('');
          setCode('');
          setPercent('');
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );

  return (
    <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <BadgePercent size={18} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Descuento{' '}
          <Typography component="span" variant="caption" color="text.secondary">
            (opcional)
          </Typography>
        </Typography>
      </Stack>

      {hasDiscount && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}
        >
          <Typography variant="body2">
            {order.discountLabel ?? 'Descuento'} ·{' '}
            <strong>−{formatCOP(order.discountAmount)}</strong>
          </Typography>
          <Button
            size="small"
            color="error"
            loading={apply.isPending}
            onClick={() => run({ source: 'NONE' }, 'Descuento quitado')}
          >
            Quitar
          </Button>
        </Stack>
      )}

      <Stack spacing={1.25}>
        <ToggleButtonGroup
          exclusive
          size="small"
          fullWidth
          value={mode}
          onChange={(_e, value: Mode | null) => value && setMode(value)}
        >
          <ToggleButton value="PROMOTION">Promoción</ToggleButton>
          <ToggleButton value="COUPON">Cupón</ToggleButton>
          <ToggleButton value="MANUAL">Porcentaje</ToggleButton>
        </ToggleButtonGroup>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
          {mode === 'PROMOTION' && (
            <TextField
              select
              size="small"
              fullWidth
              label="Promoción"
              value={promotionId}
              onChange={(e) => setPromotionId(e.target.value)}
              helperText={promotions.length === 0 ? 'No hay promociones vigentes' : undefined}
            >
              {promotions.map((promotion) => (
                <MenuItem key={promotion.id} value={promotion.id}>
                  {promotion.name} · {promotion.percent}%
                </MenuItem>
              ))}
            </TextField>
          )}
          {mode === 'COUPON' && (
            <TextField
              size="small"
              fullWidth
              label="Código del cupón"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              slotProps={{ htmlInput: { maxLength: 30, autoCapitalize: 'characters' } }}
            />
          )}
          {mode === 'MANUAL' && (
            <TextField
              size="small"
              fullWidth
              label="Porcentaje de descuento"
              value={percent}
              onChange={(e) => setPercent(e.target.value.replace(/[^\d.,]/g, ''))}
              slotProps={{
                htmlInput: { inputMode: 'decimal' },
                input: { endAdornment: <span>%</span> },
              }}
              helperText={
                percentValue > 0 && percentValue <= 100
                  ? `−${formatCOP(Math.round(order.subtotal * percentValue) / 100)} sobre el subtotal`
                  : 'Ej. 5 cobra el total menos el 5%'
              }
              error={percent !== '' && !(percentValue > 0 && percentValue <= 100)}
            />
          )}
          <Button
            variant="contained"
            disabled={!payload}
            loading={apply.isPending}
            onClick={() =>
              payload && run(payload, hasDiscount ? 'Descuento cambiado' : 'Descuento aplicado')
            }
            sx={{ flexShrink: 0, height: 40 }}
          >
            {hasDiscount ? 'Cambiar' : 'Aplicar'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
