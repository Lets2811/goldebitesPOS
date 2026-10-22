import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { ColumnDef } from '@tanstack/react-table';
import { ExternalLink, Link2, MessageCircle, PhoneCall, Receipt } from 'lucide-react';
import { useSnackbar } from 'notistack';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import SearchInput from '../../../components/common/SearchInput';
import DataTable from '../../../components/common/DataTable';
import ErrorState from '../../../components/common/ErrorState';
import FilterBar from '../../../components/common/FilterBar';
import StatusChip from '../../../components/common/StatusChip';
import { normalizeApiError } from '../../../lib/api/api-error';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_TONES,
  formatDistance,
} from '../../../modules/deliveries/delivery-pricing';
import {
  useAssignCourier,
  useCallCourierAsStaff,
  useChangeDeliveryStatus,
  useCouriers,
  useDeliveries,
} from '../../../modules/deliveries/hooks/use-deliveries';
import type { Delivery, DeliveryStatus } from '../../../modules/deliveries/types/delivery.types';
import { formatCOP, formatTimeCO } from '../../../utils/format';
import LinkOrderDialog from './LinkOrderDialog';
import StaffDeliveryChatDrawer from './StaffDeliveryChatDrawer';
import ShareTrackingDialog from './ShareTrackingDialog';

/** Directions in Google Maps, for whoever rides it. */
const directionsUrl = (delivery: Delivery) =>
  `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${delivery.origin.latitude},${delivery.origin.longitude}&destination=${delivery.destination.latitude},${delivery.destination.longitude}`;

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const OPEN_STATUSES: DeliveryStatus[] = ['PENDING', 'ASSIGNED', 'IN_TRANSIT'];

export default function DeliveriesList() {
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('deliveries.manage');
  const [day, setDay] = useState(todayIso);
  const [status, setStatus] = useState<DeliveryStatus | ''>('');
  const [cancelling, setCancelling] = useState<Delivery | null>(null);
  const [chatting, setChatting] = useState<Delivery | null>(null);
  const [sharing, setSharing] = useState<Delivery | null>(null);
  const [linking, setLinking] = useState<Delivery | null>(null);
  const [search, setSearch] = useState('');

  const filters = useMemo(
    () => ({
      from: new Date(`${day}T00:00:00`).toISOString(),
      to: new Date(`${day}T23:59:59.999`).toISOString(),
      status: status || undefined,
    }),
    [day, status],
  );
  const { data: deliveries = [], isLoading, isError, refetch } = useDeliveries(filters);
  const { data: couriers = [] } = useCouriers();
  const assign = useAssignCourier();
  const changeStatus = useChangeDeliveryStatus();
  const callCourier = useCallCourierAsStaff();

  const ring = (delivery: Delivery) =>
    callCourier.mutate(delivery.id, {
      onSuccess: (result) => {
        const name = delivery.courier?.name ?? 'el domiciliario';
        if (!result.called) {
          enqueueSnackbar(`Ya estamos llamando a ${name}: aún no lo ha visto`, { variant: 'info' });
        } else if (result.devices > 0) {
          enqueueSnackbar(`Llamando a ${name}: su teléfono está sonando`, { variant: 'success' });
        } else {
          enqueueSnackbar(
            `Llamando a ${name}. No tiene las notificaciones activadas: solo sonará si tiene la app abierta`,
            { variant: 'warning', autoHideDuration: 8_000 },
          );
        }
      },
      onError: showError,
    });

  const showError = (error: unknown) =>
    enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' });
  const move = (delivery: Delivery, next: DeliveryStatus) =>
    changeStatus.mutate({ id: delivery.id, status: next }, { onError: showError });

  // By code (what the customer and the courier say), order number, customer, phone or address.
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return deliveries;
    return deliveries.filter((d) =>
      [
        d.trackingCode,
        d.orderNumber,
        d.customerName,
        d.customerPhone,
        d.destination.address,
        d.courier?.name,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }, [deliveries, search]);

  const totals = useMemo(() => {
    const live = deliveries.filter((d) => d.status !== 'CANCELLED');
    return { count: live.length, fees: live.reduce((sum, d) => sum + d.fee, 0) };
  }, [deliveries]);

  const columns: ColumnDef<Delivery, unknown>[] = [
    {
      id: 'code',
      header: 'Código',
      cell: ({ row }) => (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 800,
              letterSpacing: 1.5,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {row.original.trackingCode}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.original.orderNumber ? `Pedido #${row.original.orderNumber}` : 'Sin pedido'}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'time',
      header: 'Hora',
      cell: ({ row }) => (
        <Box>
          <Typography variant="body2">{formatTimeCO(row.original.createdAt)}</Typography>
          <Typography variant="caption" color="text.secondary">
            {row.original.branchName}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'destination',
      header: 'Destino',
      cell: ({ row }) => (
        <Box sx={{ maxWidth: 320 }}>
          <Typography variant="body2" noWrap title={row.original.destination.address}>
            {row.original.destination.address}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {[row.original.customerName, row.original.customerPhone].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'distance',
      header: 'Distancia',
      cell: ({ row }) => formatDistance(row.original.distanceMeters),
    },
    {
      id: 'fee',
      header: 'Valor',
      cell: ({ row }) => (
        <Typography sx={{ fontWeight: 600 }}>{formatCOP(row.original.fee)}</Typography>
      ),
    },
    {
      id: 'courier',
      header: 'Domiciliario',
      cell: ({ row }) => {
        const delivery = row.original;
        const editable = canManage && OPEN_STATUSES.includes(delivery.status);
        if (!editable) return delivery.courier?.name ?? '—';
        return (
          <TextField
            select
            size="small"
            value={delivery.courier?.id ?? ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) =>
              assign.mutate(
                { id: delivery.id, courierUserId: e.target.value || null },
                { onError: showError },
              )
            }
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="" disabled={delivery.status === 'IN_TRANSIT'}>
              Sin asignar
            </MenuItem>
            {couriers.map((courier) => (
              <MenuItem key={courier.id} value={courier.id}>
                {courier.name}
              </MenuItem>
            ))}
          </TextField>
        );
      },
    },
    {
      id: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <StatusChip
          label={DELIVERY_STATUS_LABELS[row.original.status]}
          tone={DELIVERY_STATUS_TONES[row.original.status]}
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const delivery = row.original;
        return (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ alignItems: 'center', justifyContent: 'flex-end' }}
          >
            {canManage && delivery.status === 'ASSIGNED' && (
              <Button size="small" onClick={() => move(delivery, 'IN_TRANSIT')}>
                En camino
              </Button>
            )}
            {canManage && (delivery.status === 'ASSIGNED' || delivery.status === 'IN_TRANSIT') && (
              <Button size="small" color="success" onClick={() => move(delivery, 'DELIVERED')}>
                Entregado
              </Button>
            )}
            {canManage && OPEN_STATUSES.includes(delivery.status) && (
              <Button size="small" color="error" onClick={() => setCancelling(delivery)}>
                Cancelar
              </Button>
            )}
            {canManage && delivery.courier && OPEN_STATUSES.includes(delivery.status) && (
              <Tooltip title={`Llamar a ${delivery.courier.name}: su teléfono suena hasta que lo vea`}>
                <IconButton
                  size="small"
                  color="warning"
                  disabled={callCourier.isPending && callCourier.variables === delivery.id}
                  onClick={() => ring(delivery)}
                >
                  <PhoneCall size={16} />
                </IconButton>
              </Tooltip>
            )}
            {canManage && delivery.status !== 'CANCELLED' && (
              <Tooltip
                title={
                  delivery.orderNumber
                    ? `Pedido #${delivery.orderNumber}: cambiar o desvincular`
                    : 'Vincular a un pedido'
                }
              >
                <IconButton
                  size="small"
                  color={delivery.orderNumber ? 'primary' : 'default'}
                  onClick={() => setLinking(delivery)}
                >
                  <Receipt size={16} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip
              title={`Enlace de seguimiento para el cliente (código ${delivery.trackingCode})`}
            >
              <IconButton size="small" onClick={() => setSharing(delivery)}>
                <Link2 size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Chat con el cliente y el domiciliario">
              <IconButton size="small" onClick={() => setChatting(delivery)}>
                <MessageCircle size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Ver ruta en Google Maps">
              <IconButton
                size="small"
                component="a"
                href={directionsUrl(delivery)}
                target="_blank"
                rel="noopener"
              >
                <ExternalLink size={16} />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
    },
  ];

  return (
    <Stack spacing={2}>
      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Código, pedido, cliente o dirección"
          size="small"
        />
        <TextField
          type="date"
          size="small"
          label="Día"
          value={day}
          onChange={(e) => setDay(e.target.value || todayIso())}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          select
          size="small"
          label="Estado"
          value={status}
          onChange={(e) => setStatus(e.target.value as DeliveryStatus | '')}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {(Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[]).map((key) => (
            <MenuItem key={key} value={key}>
              {DELIVERY_STATUS_LABELS[key]}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
          {totals.count} domicilio{totals.count === 1 ? '' : 's'} · {formatCOP(totals.fees)}
        </Typography>
      </FilterBar>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={shown}
          isLoading={isLoading}
          emptyTitle={
            search ? 'Ningún domicilio coincide con la búsqueda' : 'No hay domicilios este día'
          }
          pageSize={25}
        />
      )}

      <StaffDeliveryChatDrawer
        target={
          chatting && {
            deliveryId: chatting.id,
            subtitle: `${chatting.destination.address} · código ${chatting.trackingCode}`,
            open: OPEN_STATUSES.includes(chatting.status),
          }
        }
        onClose={() => setChatting(null)}
      />

      <ShareTrackingDialog delivery={sharing} onClose={() => setSharing(null)} />
      <LinkOrderDialog delivery={linking} onClose={() => setLinking(null)} />

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancelar domicilio"
        description={`¿Cancelar el domicilio a ${cancelling?.destination.address ?? ''}?`}
        confirmLabel="Cancelar domicilio"
        cancelLabel="Volver"
        destructive
        onClose={() => setCancelling(null)}
        onConfirm={() => {
          if (cancelling) move(cancelling, 'CANCELLED');
          setCancelling(null);
        }}
      />
    </Stack>
  );
}
