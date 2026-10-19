import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { Crosshair } from 'lucide-react';
import { useSnackbar } from 'notistack';
import CurrencyField from '../../../components/common/CurrencyField';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import StatusChip from '../../../components/common/StatusChip';
import { normalizeApiError } from '../../../lib/api/api-error';
import { describeUnit, formatDistance, quoteDelivery } from '../../../modules/deliveries/delivery-pricing';
import {
  useBranchLocations,
  useDeliverySettings,
  useSaveDeliverySettings,
  useSetBranchLocation,
} from '../../../modules/deliveries/hooks/use-deliveries';
import type {
  BillingMode,
  DeliveryPricing,
  DeliverySettings,
  DistanceUnit,
  LatLng,
} from '../../../modules/deliveries/types/delivery.types';
import { formatCOP } from '../../../utils/format';
import { branchPoint, currentPosition } from '../geo';
import AddressSearch from './AddressSearch';
import DeliveryMap from './DeliveryMap';

interface PricingForm {
  baseFee: number | '';
  pricePerUnit: number | '';
  unit: DistanceUnit;
  unitSize: string;
  billingMode: BillingMode;
  minimumFee: number | '';
  roundingStep: number | '';
}

const fromSettings = (settings: DeliverySettings): PricingForm => ({
  baseFee: settings.baseFee,
  pricePerUnit: settings.configured ? settings.pricePerUnit : '',
  unit: settings.unit,
  unitSize: String(settings.unitSize),
  billingMode: settings.billingMode,
  minimumFee: settings.minimumFee,
  roundingStep: settings.roundingStep,
});

/** Distances the example under the form prices. */
const EXAMPLE_DISTANCES = [1200, 3400, 7800];

function PricingCard({ settings }: { settings: DeliverySettings }) {
  const { enqueueSnackbar } = useSnackbar();
  const save = useSaveDeliverySettings();
  const [form, setForm] = useState<PricingForm>(() => fromSettings(settings));
  const set = <K extends keyof PricingForm>(key: K, value: PricingForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const unitSize = Number(form.unitSize.replace(',', '.'));
  const pricing: DeliveryPricing | null =
    form.pricePerUnit !== '' && unitSize > 0
      ? {
          baseFee: Number(form.baseFee || 0),
          pricePerUnit: form.pricePerUnit,
          unit: form.unit,
          unitSize,
          billingMode: form.billingMode,
          minimumFee: Number(form.minimumFee || 0),
          roundingStep: Number(form.roundingStep || 0),
        }
      : null;

  return (
    <Card sx={{ p: 2.5 }}>
      <Stack spacing={2.25}>
        <Box>
          <Typography variant="h6">Tarifa</Typography>
          <Typography variant="body2" color="text.secondary">
            El valor de cada domicilio sale de la distancia por carretera. La base es opcional: déjala en 0 para
            cobrar solo por distancia.
          </Typography>
        </Box>
        {!settings.configured && <Alert severity="info">Guarda la tarifa para poder crear domicilios.</Alert>}

        <Stack direction="row" spacing={1.5}>
          <CurrencyField
            label="Precio"
            value={form.pricePerUnit}
            onChange={(value) => set('pricePerUnit', value)}
            required
            sx={{ flex: 1 }}
          />
          <TextField
            label="Por cada"
            value={form.unitSize}
            onChange={(e) => set('unitSize', e.target.value.replace(/[^\d.,]/g, ''))}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            sx={{ width: 110 }}
            error={!(unitSize > 0)}
          />
          <TextField
            select
            label="Unidad"
            value={form.unit}
            onChange={(e) => set('unit', e.target.value as DistanceUnit)}
            sx={{ width: 120 }}
          >
            <MenuItem value="KM">km</MenuItem>
            <MenuItem value="M">metros</MenuItem>
          </TextField>
        </Stack>

        <Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.75 }}>
            Cómo contar la distancia
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={form.billingMode}
            onChange={(_e, value: BillingMode | null) => value && set('billingMode', value)}
          >
            <ToggleButton value="PROPORTIONAL">Exacta (3,4 km = 3,4)</ToggleButton>
            <ToggleButton value="FULL_UNITS">Por unidad iniciada (3,4 km = 4)</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <CurrencyField
            label="Base (opcional)"
            value={form.baseFee}
            onChange={(value) => set('baseFee', value)}
            sx={{ flex: 1 }}
          />
          <CurrencyField
            label="Valor mínimo (opcional)"
            value={form.minimumFee}
            onChange={(value) => set('minimumFee', value)}
            sx={{ flex: 1 }}
          />
          <CurrencyField
            label="Redondear a"
            value={form.roundingStep}
            onChange={(value) => set('roundingStep', value)}
            helperText="0 = sin redondeo"
            sx={{ flex: 1 }}
          />
        </Stack>

        {pricing && (
          <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
              {formatCOP(pricing.pricePerUnit)} {describeUnit(pricing)}
              {pricing.baseFee > 0 ? ` + base ${formatCOP(pricing.baseFee)}` : ''}. Por ejemplo:
            </Typography>
            <Stack direction="row" spacing={3}>
              {EXAMPLE_DISTANCES.map((meters) => (
                <Typography key={meters} variant="body2">
                  {formatDistance(meters)} → <strong>{formatCOP(quoteDelivery(meters, pricing).fee)}</strong>
                </Typography>
              ))}
            </Stack>
          </Box>
        )}

        <Box>
          <Button
            variant="contained"
            disabled={!pricing}
            loading={save.isPending}
            onClick={() =>
              pricing &&
              save.mutate(pricing, {
                onSuccess: () => enqueueSnackbar('Tarifa guardada', { variant: 'success' }),
                onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
              })
            }
          >
            Guardar tarifa
          </Button>
        </Box>
      </Stack>
    </Card>
  );
}

function BranchLocationsCard() {
  const { enqueueSnackbar } = useSnackbar();
  const { data: branches = [] } = useBranchLocations();
  const setLocation = useSetBranchLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = branches.find((b) => b.branchId === (selectedId ?? branches[0]?.branchId));
  const [draft, setDraft] = useState<LatLng | null>(null);
  const [search, setSearch] = useState('');
  const [locating, setLocating] = useState(false);
  const point = draft ?? branchPoint(selected) ?? null;

  const choose = (branchId: string) => {
    setSelectedId(branchId);
    setDraft(null);
    setSearch('');
  };

  async function locateHere() {
    setLocating(true);
    try {
      setDraft(await currentPosition());
    } catch (cause) {
      enqueueSnackbar(cause instanceof Error ? cause.message : 'No se pudo ubicarte', { variant: 'warning' });
    } finally {
      setLocating(false);
    }
  }

  return (
    <Card sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">Ubicación de las sedes</Typography>
          <Typography variant="body2" color="text.secondary">
            Es el punto A de los domicilios de cada sede. Búscala por dirección, usa tu ubicación si estás en ella,
            o arrastra el pin hasta la puerta.
          </Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <List dense disablePadding>
              {branches.map((branch) => (
                <ListItemButton
                  key={branch.branchId}
                  selected={branch.branchId === selected?.branchId}
                  onClick={() => choose(branch.branchId)}
                  sx={{ borderRadius: 1 }}
                >
                  <ListItemText
                    primary={branch.branchName}
                    secondary={
                      <StatusChip
                        label={branchPoint(branch) ? 'Ubicada' : 'Sin ubicar'}
                        tone={branchPoint(branch) ? 'success' : 'warning'}
                      />
                    }
                    slotProps={{ secondary: { component: 'div' } }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Grid>
          <Grid size={{ xs: 12, sm: 8 }}>
            {selected && (
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1}>
                  <Box sx={{ flex: 1 }}>
                    <AddressSearch
                      label={`Dirección de ${selected.branchName}`}
                      text={search}
                      onTextChange={setSearch}
                      onPlace={(place) => setDraft({ latitude: place.latitude, longitude: place.longitude })}
                      near={point}
                      helperText={selected.branchAddress ? `Registrada: ${selected.branchAddress}` : undefined}
                    />
                  </Box>
                  <Button
                    variant="outlined"
                    onClick={() => void locateHere()}
                    loading={locating}
                    sx={{ minWidth: 0, px: 1.5, alignSelf: 'flex-start', height: 56 }}
                    title="Estoy en la sede: usar mi ubicación"
                  >
                    <Crosshair size={18} />
                  </Button>
                </Stack>
                <DeliveryMap
                  origin={point}
                  onOriginChange={setDraft}
                  onMapClick={(clicked) => setDraft(clicked)}
                  height={340}
                />
                <Box>
                  <Button
                    variant="contained"
                    disabled={!draft}
                    loading={setLocation.isPending}
                    onClick={() =>
                      draft &&
                      setLocation.mutate(
                        { branchId: selected.branchId, location: draft },
                        {
                          onSuccess: () => {
                            setDraft(null);
                            enqueueSnackbar(`Ubicación de ${selected.branchName} guardada`, { variant: 'success' });
                          },
                          onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
                        },
                      )
                    }
                  >
                    Guardar ubicación
                  </Button>
                </Box>
              </Stack>
            )}
          </Grid>
        </Grid>
      </Stack>
    </Card>
  );
}

export default function DeliverySettingsPanel() {
  const { data: settings, isLoading } = useDeliverySettings();
  if (isLoading || !settings) return <LoadingSkeleton />;
  return (
    <Stack spacing={2.5}>
      <PricingCard key={settings.updatedAt ?? 'new'} settings={settings} />
      <BranchLocationsCard />
    </Stack>
  );
}
