import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import DetailDrawer from '../../../shared/components/common/DetailDrawer';
import LoadingSkeleton from '../../../shared/components/common/LoadingSkeleton';
import { normalizeApiError } from '../../../shared/lib/api/api-error';
import {
  useEInvoicingSettings,
  useSaveEInvoicingSettings,
  useTestEInvoicingConnection,
} from '../../../modules/integrations/e-invoicing';
import type {
  EInvoiceTaxCode,
  EInvoicingEnvironment,
  EInvoicingSettings,
  EInvoicingSettingsPayload,
  NumberingRange,
} from '../../../shared/modules/e-invoicing/types/e-invoicing.types';
import type { Business } from '../../../modules/businesses/types/platform-admin.types';

interface Form {
  environment: EInvoicingEnvironment;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  numberingRangeId: number | '';
  taxCode: EInvoiceTaxCode;
}

const fromSettings = (settings: EInvoicingSettings | undefined): Form => ({
  environment: settings?.environment ?? 'SANDBOX',
  clientId: settings?.clientId ?? '',
  clientSecret: '',
  username: settings?.username ?? '',
  password: '',
  numberingRangeId: settings?.numberingRangeId ?? '',
  taxCode: settings?.taxCode ?? '04',
});

/**
 * Conecta una empresa con SU cuenta de Factus (cada NIT factura con su propia
 * cuenta y resolución DIAN). Las claves se guardan cifradas y nunca se muestran.
 */
export default function BusinessEInvoicingDrawer({ business, onClose }: { business: Business | null; onClose: () => void }) {
  return business ? <EInvoicingContent key={business.id} business={business} onClose={onClose} /> : null;
}

function EInvoicingContent({ business, onClose }: { business: Business; onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const { data: settings, isLoading } = useEInvoicingSettings(business.id);
  const save = useSaveEInvoicingSettings(business.id);
  const test = useTestEInvoicingConnection(business.id);
  const [form, setForm] = useState<Form>(() => fromSettings(undefined));
  const [loadedFrom, setLoadedFrom] = useState<EInvoicingSettings | undefined>(undefined);
  const [ranges, setRanges] = useState<NumberingRange[] | null>(null);
  if (settings && settings !== loadedFrom) {
    setLoadedFrom(settings);
    setForm(fromSettings(settings));
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const needsSecrets = !settings?.hasSecrets;
  const complete =
    form.clientId.trim() !== '' && form.username.trim() !== '' && (!needsSecrets || (form.clientSecret !== '' && form.password !== ''));
  const payload = (): EInvoicingSettingsPayload => ({
    environment: form.environment,
    clientId: form.clientId.trim(),
    clientSecret: form.clientSecret || undefined,
    username: form.username.trim(),
    password: form.password || undefined,
    numberingRangeId: form.numberingRangeId === '' ? null : form.numberingRangeId,
    taxCode: form.taxCode,
  });
  const showError = (error: unknown) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' });

  const runTest = () =>
    test.mutate(payload(), {
      onSuccess: (found) => {
        setRanges(found);
        if (found.length === 1 && form.numberingRangeId === '') set('numberingRangeId', found[0].id);
        enqueueSnackbar(`Conexión correcta: ${found.length} rango(s) de facturación`, { variant: 'success' });
      },
      onError: showError,
    });

  const runSave = () =>
    save.mutate(payload(), {
      onSuccess: () => enqueueSnackbar('Facturación electrónica guardada', { variant: 'success' }),
      onError: showError,
    });

  return (
    <DetailDrawer
      open
      title="Facturación electrónica"
      subtitle={`${business.name} · conexión con Factus (DIAN)`}
      onClose={onClose}
      width={560}
      footer={
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button disabled={!complete || test.isPending} onClick={runTest}>
            {test.isPending ? 'Probando…' : 'Probar conexión'}
          </Button>
          <Button variant="contained" disabled={!complete || save.isPending} onClick={runSave}>
            Guardar
          </Button>
        </Stack>
      }
    >
      {isLoading ? (
        <LoadingSkeleton variant="table" rows={4} />
      ) : (
        <Stack spacing={2.5}>
          {settings && !settings.encryptionReady && (
            <Alert severity="error">
              El servidor no tiene CREDENTIALS_ENCRYPTION_KEY: no se pueden guardar credenciales hasta configurarla.
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary">
            Cada empresa factura con su propia cuenta de Factus y su resolución de la DIAN. Recuerda activar también el módulo
            "Facturación electrónica (DIAN)" en Módulos.
          </Typography>
          <ToggleButtonGroup exclusive size="small" value={form.environment} onChange={(_e, v) => v && set('environment', v)}>
            <ToggleButton value="SANDBOX">Pruebas (sandbox)</ToggleButton>
            <ToggleButton value="PRODUCTION">Producción</ToggleButton>
          </ToggleButtonGroup>
          {form.environment === 'PRODUCTION' && (
            <Alert severity="warning">En producción cada factura tiene validez fiscal ante la DIAN.</Alert>
          )}
          <TextField label="Client ID" value={form.clientId} onChange={(e) => set('clientId', e.target.value)} required />
          <TextField
            label="Client secret"
            type="password"
            value={form.clientSecret}
            onChange={(e) => set('clientSecret', e.target.value)}
            helperText={settings?.hasSecrets ? 'Guardado. Déjalo vacío para conservarlo.' : undefined}
            required={needsSecrets}
            autoComplete="off"
          />
          <TextField label="Usuario (correo de Factus)" value={form.username} onChange={(e) => set('username', e.target.value)} required />
          <TextField
            label="Contraseña de Factus"
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            helperText={settings?.hasSecrets ? 'Guardada. Déjala vacía para conservarla.' : undefined}
            required={needsSecrets}
            autoComplete="new-password"
          />
          <TextField select label="Impuesto que cobra la empresa" value={form.taxCode} onChange={(e) => set('taxCode', e.target.value as EInvoiceTaxCode)}>
            <MenuItem value="04">INC · Impuesto al consumo (restaurantes y bares)</MenuItem>
            <MenuItem value="01">IVA</MenuItem>
          </TextField>
          <TextField
            select
            label="Rango de numeración (resolución DIAN)"
            value={form.numberingRangeId}
            onChange={(e) => set('numberingRangeId', e.target.value === '' ? '' : Number(e.target.value))}
            helperText={ranges ? undefined : 'Prueba la conexión para ver los rangos de la cuenta'}
          >
            <MenuItem value="">Automático (si la cuenta tiene uno solo)</MenuItem>
            {(ranges ?? []).map((range) => (
              <MenuItem key={range.id} value={range.id}>
                {range.prefix} · {range.document} · va en {range.current ?? '—'} de {range.to ?? '—'}
                {range.endDate ? ` · vence ${range.endDate}` : ''}
              </MenuItem>
            ))}
            {ranges === null && form.numberingRangeId !== '' && (
              <MenuItem value={form.numberingRangeId}>Rango #{form.numberingRangeId} (guardado)</MenuItem>
            )}
          </TextField>
          {settings?.configured && settings.updatedAt && (
            <Typography variant="caption" color="text.secondary">
              Configurada · última actualización {new Date(settings.updatedAt).toLocaleString('es-CO')}
            </Typography>
          )}
        </Stack>
      )}
    </DetailDrawer>
  );
}
