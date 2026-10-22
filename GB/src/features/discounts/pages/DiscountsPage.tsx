import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { BadgePercent, Pencil, Plus, Ticket, Trash2 } from 'lucide-react';
import { useSnackbar } from 'notistack';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import EmptyState from '../../../components/common/EmptyState';
import ErrorState from '../../../components/common/ErrorState';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import PageHeader from '../../../components/common/PageHeader';
import StatusChip, { type StatusTone } from '../../../components/common/StatusChip';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useDeleteDiscount, useDiscounts } from '../../../modules/discounts/hooks/use-discounts';
import type { Discount, DiscountKind } from '../../../modules/discounts/types/discount.types';
import { formatDateCO } from '../../../utils/format';
import DiscountFormDrawer from '../components/DiscountFormDrawer';

/** Why a discount can't be applied right now, or that it can. */
function statusOf(discount: Discount): { label: string; tone: StatusTone } {
  if (discount.usableNow) return { label: 'Vigente', tone: 'success' };
  if (!discount.isActive) return { label: 'Desactivado', tone: 'neutral' };
  const now = Date.now();
  if (discount.startsAt && new Date(discount.startsAt).getTime() > now)
    return { label: 'Programado', tone: 'info' };
  if (discount.endsAt && new Date(discount.endsAt).getTime() < now)
    return { label: 'Vencido', tone: 'neutral' };
  return { label: 'Sin usos', tone: 'warning' };
}

function validity(discount: Discount): string {
  if (discount.startsAt && discount.endsAt)
    return `${formatDateCO(discount.startsAt)} – ${formatDateCO(discount.endsAt)}`;
  if (discount.startsAt) return `Desde ${formatDateCO(discount.startsAt)}`;
  if (discount.endsAt) return `Hasta ${formatDateCO(discount.endsAt)}`;
  return 'Sin fecha límite';
}

/**
 * Descuentos: promociones para eventos y temporadas (se eligen de la lista
 * al cobrar) y cupones (se aplican con su código). El porcentaje manual se
 * da al cobrar y no se administra aquí.
 */
export default function DiscountsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { data: discounts = [], isLoading, isError, refetch } = useDiscounts();
  const remove = useDeleteDiscount();
  const [tab, setTab] = useState<DiscountKind>('PROMOTION');
  const [editing, setEditing] = useState<Discount | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  /** Remounts the form on each open so it starts from the discount being edited. */
  const [formKey, setFormKey] = useState(0);
  const [deleting, setDeleting] = useState<Discount | null>(null);

  const isCoupon = tab === 'COUPON';
  const rows = discounts.filter((discount) => discount.kind === tab);

  const openForm = (discount: Discount | null) => {
    setEditing(discount);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        enqueueSnackbar('Descuento eliminado', { variant: 'success' });
        setDeleting(null);
      },
      onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
    });
  };

  return (
    <>
      <PageHeader
        title="Descuentos"
        subtitle="Promociones para eventos y cupones con código, para aplicar al cobrar un pedido."
        breadcrumbs={[{ label: 'Operación diaria' }, { label: 'Descuentos' }]}
        actions={
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => openForm(null)}>
            {isCoupon ? 'Nuevo cupón' : 'Nueva promoción'}
          </Button>
        }
      />
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2.5 }}>
        <Tabs value={tab} onChange={(_e, value: DiscountKind) => setTab(value)}>
          <Tab value="PROMOTION" label="Promociones" />
          <Tab value="COUPON" label="Cupones" />
        </Tabs>
      </Box>

      {isLoading ? (
        <LoadingSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={isCoupon ? Ticket : BadgePercent}
          title={isCoupon ? 'Aún no hay cupones' : 'Aún no hay promociones'}
          description={
            isCoupon
              ? 'Crea un código (ej. VERANO10) que el cliente presenta al pagar.'
              : 'Crea una promoción para un evento o temporada; aparecerá en la lista al cobrar mientras esté vigente.'
          }
          actionLabel={isCoupon ? 'Nuevo cupón' : 'Nueva promoción'}
          onAction={() => openForm(null)}
        />
      ) : (
        <Stack spacing={1.5}>
          {rows.map((discount) => {
            const status = statusOf(discount);
            return (
              <Paper key={discount.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 800, minWidth: 72, textAlign: 'center' }}
                  >
                    {discount.percent}%
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {discount.name}
                      </Typography>
                      {discount.code && <StatusChip label={discount.code} tone="gold" />}
                      <StatusChip label={status.label} tone={status.tone} />
                    </Stack>
                    {discount.description && (
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {discount.description}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {validity(discount)} · Usos: {discount.usedCount}
                      {discount.maxUses ? ` de ${discount.maxUses}` : ''}
                    </Typography>
                  </Box>
                  <Tooltip title="Editar">
                    <IconButton onClick={() => openForm(discount)}>
                      <Pencil size={17} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Eliminar">
                    <IconButton color="error" onClick={() => setDeleting(discount)}>
                      <Trash2 size={17} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      <DiscountFormDrawer
        key={formKey}
        open={formOpen}
        kind={editing?.kind ?? tab}
        discount={editing}
        onClose={() => setFormOpen(false)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar descuento"
        description={
          deleting
            ? `"${deleting.name}" deja de poder aplicarse. Los pedidos que ya lo tienen lo conservan.`
            : undefined
        }
        confirmLabel="Eliminar"
        destructive
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
