import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Copy, Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-react';
import { useSnackbar } from 'notistack';
import ConfirmDialog from '../../../shared/components/common/ConfirmDialog';
import DetailDrawer from '../../../shared/components/common/DetailDrawer';
import LoadingSkeleton from '../../../shared/components/common/LoadingSkeleton';
import { normalizeApiError } from '../../../shared/lib/api/api-error';
import type { BusinessRef } from '../../../modules/businesses/types/platform-admin.types';
import {
  useMasterKeyStatus,
  useResetMasterKey,
  useRevealMasterKey,
} from '../../../modules/integrations/master-key';

/**
 * A business's master key ("clave maestra"): the one its owner or managers
 * type to rectify a closed cash session. Recovered and reset only here; the
 * POS never shows it. Every reveal and reset lands in the business's audit log.
 */
export default function BusinessMasterKeyDrawer({ business, onClose }: { business: BusinessRef | null; onClose: () => void }) {
  return business ? <MasterKeyContent key={business.id} business={business} onClose={onClose} /> : null;
}

function MasterKeyContent({ business, onClose }: { business: BusinessRef; onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const { data: status, isLoading } = useMasterKeyStatus(business.id);
  const reveal = useRevealMasterKey(business.id);
  const reset = useResetMasterKey(business.id);
  const [shown, setShown] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [confirming, setConfirming] = useState<'generate' | 'custom' | null>(null);
  const showError = (error: unknown) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' });

  const copy = (value: string) =>
    void navigator.clipboard
      .writeText(value)
      .then(() => enqueueSnackbar('Clave copiada', { variant: 'success' }))
      .catch(() => enqueueSnackbar('No se pudo copiar', { variant: 'error' }));

  const applyReset = (value?: string) =>
    reset.mutate(value, {
      onSuccess: (result) => {
        setShown(result.key);
        setCustom('');
        setConfirming(null);
        enqueueSnackbar('Nueva clave maestra guardada. La anterior ya no sirve.', { variant: 'success' });
      },
      onError: (error) => {
        setConfirming(null);
        showError(error);
      },
    });

  return (
    <DetailDrawer open title="Clave maestra" subtitle={`${business.name} · rectificar cajas cerradas`} onClose={onClose} width={480}>
      {isLoading || !status ? (
        <LoadingSkeleton />
      ) : (
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary">
            El dueño o los gerentes la escriben en el POS para reabrir una caja cerrada y corregirla. Solo se puede
            recuperar o cambiar aquí; el POS nunca la muestra.
          </Typography>

          {!status.hasOwnKey && (
            <Alert severity={status.usesPlatformKey ? 'warning' : 'info'}>
              {status.usesPlatformKey
                ? 'Esta empresa todavía usa la clave maestra general de la plataforma (la misma para todos). Genérale una propia.'
                : 'Esta empresa no tiene clave maestra: no puede rectificar cajas hasta que le asignes una.'}
            </Alert>
          )}

          {status.hasOwnKey && (
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography variant="caption" color="text.secondary">
                Clave actual
                {status.updatedAt ? ` · desde ${new Date(status.updatedAt).toLocaleString('es-CO')}` : ''}
              </Typography>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                <Typography
                  sx={{ flex: 1, fontSize: 24, fontWeight: 800, letterSpacing: 2, fontFamily: 'ui-monospace, Menlo, monospace' }}
                >
                  {shown ?? '•••• •••• ••••'}
                </Typography>
                {shown ? (
                  <>
                    <Tooltip title="Copiar">
                      <IconButton onClick={() => copy(shown)}>
                        <Copy size={18} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Ocultar">
                      <IconButton onClick={() => setShown(null)}>
                        <EyeOff size={18} />
                      </IconButton>
                    </Tooltip>
                  </>
                ) : (
                  <Button
                    startIcon={<Eye size={16} />}
                    loading={reveal.isPending}
                    onClick={() =>
                      reveal.mutate(undefined, { onSuccess: (result) => setShown(result.key), onError: showError })
                    }
                  >
                    Mostrar
                  </Button>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Cada vez que se muestra queda en la auditoría de la empresa.
              </Typography>
            </Box>
          )}

          <Divider />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Restablecer
          </Typography>
          <Button
            variant="contained"
            startIcon={status.hasOwnKey ? <RefreshCw size={16} /> : <KeyRound size={16} />}
            onClick={() => setConfirming('generate')}
            disabled={reset.isPending}
          >
            {status.hasOwnKey ? 'Generar una clave nueva' : 'Generar clave maestra'}
          </Button>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <TextField
              size="small"
              fullWidth
              label="O escribe una (8 a 64 caracteres)"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 64 } }}
            />
            <Button variant="outlined" disabled={custom.trim().length < 8 || reset.isPending} onClick={() => setConfirming('custom')}>
              Guardar
            </Button>
          </Stack>
        </Stack>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title="¿Cambiar la clave maestra?"
        description={`La clave actual de ${business.name} dejará de servir de inmediato. Comunícale la nueva al dueño.`}
        confirmLabel="Cambiar clave"
        cancelLabel="Cancelar"
        destructive
        loading={reset.isPending}
        onClose={() => setConfirming(null)}
        onConfirm={() => applyReset(confirming === 'custom' ? custom.trim() : undefined)}
      />
    </DetailDrawer>
  );
}
