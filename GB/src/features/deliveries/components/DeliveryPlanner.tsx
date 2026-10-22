import { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Crosshair, MapPinned, Route as RouteIcon } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { normalizeApiError } from '../../../lib/api/api-error';
import { computeRoute, type Route } from '../../../lib/google-maps/routes';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import {
  describeUnit,
  formatDistance,
  formatDuration,
  quoteDelivery,
} from '../../../modules/deliveries/delivery-pricing';
import {
  useBranchLocations,
  useCouriers,
  useCreateDelivery,
  useDeliverySettings,
  useSetBranchLocation,
} from '../../../modules/deliveries/hooks/use-deliveries';
import type { Delivery, LatLng, LinkableOrder } from '../../../modules/deliveries/types/delivery.types';
import { formatCOP } from '../../../utils/format';
import { branchPoint, currentPosition, locationAlreadyAllowed, nearestBranch } from '../geo';
import AddressSearch from './AddressSearch';
import DeliveryMap from './DeliveryMap';
import OrderPicker from './OrderPicker';
import SharedLocationDialog from './SharedLocationDialog';

const ROUTE_DEBOUNCE_MS = 400;
/** Medellín: where an unplaced branch's point A starts, to be dragged. */
const FALLBACK_ORIGIN: LatLng = { latitude: 6.2442, longitude: -75.5812 };

interface Destination extends LatLng {
  address: string;
  /** The pin was dragged off the address that was searched. */
  adjusted: boolean;
}

/**
 * Plans a delivery: point A is a branch (picked, or the nearest to this
 * device), point B an address searched or dropped on the map; both pins can
 * be dragged. The route by road gives the distance and, with the business's
 * pricing, the fee.
 */
export default function DeliveryPlanner({ onCreated }: { onCreated: (delivery: Delivery) => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = usePermissions();
  const canConfigure = hasPermission('deliveries.configure');
  const { data: branches = [] } = useBranchLocations();
  const { data: settings } = useDeliverySettings();
  const { data: couriers = [] } = useCouriers();
  const createDelivery = useCreateDelivery();
  const setBranchLocation = useSetBranchLocation();

  const activeBranches = useMemo(() => branches.filter((branch) => branch.isActive), [branches]);
  const [chosenBranchId, setBranchId] = useState('');
  // With a single branch there is nothing to choose.
  const branchId = chosenBranchId || (activeBranches.length === 1 ? activeBranches[0].branchId : '');
  const branch = activeBranches.find((b) => b.branchId === branchId);
  /** Point A when dragged off the branch for this delivery; null follows the branch. */
  const [movedOrigin, setMovedOrigin] = useState<LatLng | null>(null);
  const origin = movedOrigin ?? branchPoint(branch) ?? (branch ? FALLBACK_ORIGIN : null);

  const [addressText, setAddressText] = useState('');
  const [destination, setDestination] = useState<Destination | null>(null);
  const [details, setDetails] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [courierId, setCourierId] = useState('');
  const [order, setOrder] = useState<LinkableOrder | null>(null);

  /** The last route asked for, by the points it was asked for. */
  const [routeResult, setRouteResult] = useState<{ key: string; route?: Route; error?: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [pastingLocation, setPastingLocation] = useState(false);

  // With several branches, start on the nearest one when this device may already be located.
  useEffect(() => {
    if (branchId || activeBranches.length < 2) return;
    let cancelled = false;
    void locationAlreadyAllowed().then(async (allowed) => {
      if (!allowed) return;
      const here = await currentPosition().catch(() => null);
      const nearest = here && nearestBranch(here, activeBranches);
      if (!cancelled && nearest) setBranchId((current) => current || nearest.branchId);
    });
    return () => {
      cancelled = true;
    };
  }, [activeBranches, branchId]);

  // The route, whenever both points are set (debounced: dragging fires many changes).
  const originKey = origin ? `${origin.latitude},${origin.longitude}` : '';
  const destinationKey = destination ? `${destination.latitude},${destination.longitude}` : '';
  const routeKey = origin && destination ? `${originKey}|${destinationKey}` : '';
  useEffect(() => {
    if (!origin || !destination) return;
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      computeRoute(origin, destination, abort.signal)
        .then((computed) => setRouteResult({ key: routeKey, route: computed }))
        .catch((cause: unknown) => {
          if (!abort.signal.aborted) {
            setRouteResult({ key: routeKey, error: cause instanceof Error ? cause.message : 'Error en la ruta' });
          }
        });
    }, ROUTE_DEBOUNCE_MS);
    return () => {
      abort.abort();
      window.clearTimeout(timer);
    };
    // The keys stand for the points (new objects every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  // A result only counts for the points it was computed for.
  const current = routeKey !== '' && routeResult?.key === routeKey ? routeResult : null;
  const route = current?.route ?? null;
  const routeError = current?.error ?? null;
  const routing = routeKey !== '' && current === null;

  const quote = route && settings ? quoteDelivery(route.distanceMeters, settings) : null;

  async function locateNearestBranch() {
    setLocating(true);
    try {
      const here = await currentPosition();
      const nearest = nearestBranch(here, activeBranches);
      if (!nearest) {
        enqueueSnackbar('Ninguna sede está ubicada en el mapa todavía (Tarifa y sedes)', { variant: 'warning' });
        return;
      }
      setBranchId(nearest.branchId);
      setMovedOrigin(null);
      enqueueSnackbar(`Sede más cercana: ${nearest.branchName}`, { variant: 'info' });
    } catch (cause) {
      enqueueSnackbar(cause instanceof Error ? cause.message : 'No se pudo ubicarte', { variant: 'warning' });
    } finally {
      setLocating(false);
    }
  }

  function linkOrder(next: LinkableOrder | null) {
    setOrder(next);
    if (!next) return;
    if (next.deliveryAddress && !destination) setAddressText(next.deliveryAddress);
    if (next.customerName && !customerName) setCustomerName(next.customerName);
    if (next.customerPhone && !customerPhone) setCustomerPhone(next.customerPhone);
    if (activeBranches.some((b) => b.branchId === next.branchId)) {
      setBranchId(next.branchId);
      setMovedOrigin(null);
    }
  }

  function saveOriginAsBranchLocation() {
    if (!branch || !origin) return;
    setBranchLocation.mutate(
      { branchId: branch.branchId, location: origin },
      {
        onSuccess: () => {
          setMovedOrigin(null);
          enqueueSnackbar(`Ubicación de ${branch.branchName} guardada`, { variant: 'success' });
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );
  }

  function reset() {
    setAddressText('');
    setDestination(null);
    setDetails('');
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setCourierId('');
    setOrder(null);
    setMovedOrigin(null);
  }

  function submit() {
    if (!branch || !origin || !destination || !route) return;
    createDelivery.mutate(
      {
        branchId: branch.branchId,
        orderId: order?.id ?? null,
        courierUserId: courierId || null,
        origin,
        destination: {
          latitude: destination.latitude,
          longitude: destination.longitude,
          address: destination.address,
          details: details || null,
        },
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        notes: notes || null,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
      },
      {
        onSuccess: (delivery) => {
          reset();
          onCreated(delivery);
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );
  }

  const branchUnplaced = branch && !branchPoint(branch);

  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12, md: 5, lg: 4 }}>
        <Card sx={{ p: 2.5 }}>
          <Stack spacing={2.25}>
            {settings && !settings.configured && (
              <Alert severity="warning">
                Falta configurar la tarifa de domicilios{canConfigure ? ' en "Tarifa y sedes"' : ''}.
              </Alert>
            )}

            <Typography variant="overline" color="text.secondary">
              Punto A · sede
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                select
                label="Sede"
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setMovedOrigin(null);
                }}
                sx={{ flex: 1 }}
              >
                {activeBranches.map((b) => (
                  <MenuItem key={b.branchId} value={b.branchId}>
                    {b.branchName}
                    {branchPoint(b) ? '' : ' · sin ubicar'}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="outlined"
                onClick={() => void locateNearestBranch()}
                loading={locating}
                sx={{ minWidth: 0, px: 1.5 }}
                title="Usar mi ubicación para elegir la sede más cercana"
              >
                <Crosshair size={18} />
              </Button>
            </Stack>
            {branchUnplaced && (
              <Alert severity="info">
                Esta sede no está ubicada en el mapa: arrastra el pin A hasta ella
                {canConfigure ? ' y guárdalo' : ''}.
              </Alert>
            )}
            {movedOrigin && canConfigure && (
              <Button size="small" onClick={saveOriginAsBranchLocation} loading={setBranchLocation.isPending}>
                Guardar este punto A como ubicación de {branch?.branchName}
              </Button>
            )}

            <Divider />
            <Typography variant="overline" color="text.secondary">
              Punto B · entrega
            </Typography>
            <AddressSearch
              label="Dirección de entrega"
              text={addressText}
              onTextChange={setAddressText}
              onPlace={(place) => setDestination({ ...place, adjusted: false })}
              near={origin}
              helperText={
                destination?.adjusted
                  ? 'Ubicación ajustada en el mapa'
                  : destination
                    ? undefined
                    : 'También puedes tocar el mapa para poner el punto B'
              }
            />
            <Button
              variant="outlined"
              color="success"
              startIcon={<MapPinned size={18} />}
              onClick={() => setPastingLocation(true)}
            >
              Pegar ubicación de WhatsApp
            </Button>
            <SharedLocationDialog
              open={pastingLocation}
              onClose={() => setPastingLocation(false)}
              onLocated={(shared) => {
                const address = addressText.trim() || shared.label || 'Ubicación compartida por WhatsApp';
                if (!addressText.trim()) setAddressText(address);
                setDestination({ latitude: shared.latitude, longitude: shared.longitude, address, adjusted: false });
                enqueueSnackbar(
                  addressText.trim() || shared.label
                    ? 'Punto B ubicado con la ubicación compartida'
                    : 'Punto B ubicado. Escribe la dirección o una referencia para el domiciliario',
                  { variant: 'success' },
                );
              }}
            />
            <TextField
              label="Apartamento, torre, indicaciones"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            <Stack direction="row" spacing={1.5}>
              <TextField
                label="Cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Teléfono"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                sx={{ flex: 1 }}
                inputMode="tel"
              />
            </Stack>

            <Divider />
            <TextField
              select
              label="Domiciliario"
              value={courierId}
              onChange={(e) => setCourierId(e.target.value)}
              helperText={
                couriers.length === 0
                  ? 'No hay usuarios con el rol Domiciliario: créalos en Roles y permisos / Usuarios'
                  : 'Opcional: puedes asignarlo después'
              }
            >
              <MenuItem value="">Sin asignar</MenuItem>
              {couriers.map((courier) => (
                <MenuItem key={courier.id} value={courier.id}>
                  {courier.name}
                </MenuItem>
              ))}
            </TextField>
            <OrderPicker value={order} onChange={linkOrder} />
            <TextField label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} />
          </Stack>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 7, lg: 8 }}>
        <Stack spacing={2}>
          <DeliveryMap
            origin={origin}
            destination={destination}
            path={route?.path}
            onOriginChange={setMovedOrigin}
            onDestinationChange={(point) =>
              setDestination((current) => ({
                ...point,
                address: current?.address || addressText || 'Punto marcado en el mapa',
                adjusted: true,
              }))
            }
            onMapClick={(point) => {
              if (!destination) {
                setDestination({ ...point, address: addressText || 'Punto marcado en el mapa', adjusted: true });
              }
            }}
            height={520}
          />

          <Card sx={{ p: 2.5 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2.5}
              sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
            >
              <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
                <Box sx={{ color: 'primary.main' }}>
                  <RouteIcon size={28} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Distancia
                  </Typography>
                  <Typography variant="h6">{route ? formatDistance(route.distanceMeters) : '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Tiempo aprox.
                  </Typography>
                  <Typography variant="h6">{route ? formatDuration(route.durationSeconds) : '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Valor del domicilio
                  </Typography>
                  <Typography variant="h6" color="primary.main">
                    {quote ? formatCOP(quote.fee) : '—'}
                  </Typography>
                </Box>
              </Stack>
              <Button
                variant="contained"
                size="large"
                disabled={!branch || !destination || !route || !settings?.configured}
                loading={createDelivery.isPending}
                onClick={submit}
              >
                Crear domicilio
              </Button>
            </Stack>
            {routing && (
              <Typography variant="caption" color="text.secondary">
                Calculando la ruta…
              </Typography>
            )}
            {routeError && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {routeError}
              </Alert>
            )}
            {quote && settings && (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                {settings.baseFee > 0 ? `Base ${formatCOP(settings.baseFee)} + ` : ''}
                {quote.units.toLocaleString('es-CO')} × {formatCOP(settings.pricePerUnit)} {describeUnit(settings)}
                {settings.minimumFee > 0 ? ` · mínimo ${formatCOP(settings.minimumFee)}` : ''}
                {settings.roundingStep > 0 ? ` · redondeado a ${formatCOP(settings.roundingStep)}` : ''}
              </Typography>
            )}
          </Card>
        </Stack>
      </Grid>
    </Grid>
  );
}
