import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import DetailDrawer from '../../../components/common/DetailDrawer';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import { env } from '../../../config/env';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useBusinessUsers } from '../../../modules/platform-admin/hooks/use-business-users';
import { useSetBusinessFeature } from '../../../modules/platform-admin/hooks/use-set-business-feature';
import { turaLinksKeys } from '../../../modules/tura-links/api/tura-links.api';
import {
  useGeneratePlatformTuraCode,
  usePlatformTura,
  useRevokePlatformTuraLink,
} from '../../../modules/tura-links/hooks/use-tura-links';
import type { TuraLinkCode } from '../../../modules/tura-links/types/tura-link.types';
import type { Business } from '../../../modules/platform-admin/types/platform-admin.types';

const TURA_FEATURE = 'tura';

function formatDate(value: string | null): string {
  return value
    ? new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Nunca';
}

/** QR de la app de TURA, para abrirla en el celular sin escribir la dirección. */
function TuraAppQr({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void import('qrcode').then((QRCode) =>
      QRCode.toDataURL(url, { margin: 1, width: 160 }).then((value) => {
        if (!cancelled) setDataUrl(value);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [url]);
  return dataUrl ? <Box component="img" src={dataUrl} alt="QR de la app TURA" sx={{ width: 120, height: 120 }} /> : null;
}

/**
 * Conecta TURA (el asistente) con los usuarios de una empresa sin que su
 * equipo tenga que hacerlo: el administrador activa el módulo, elige el
 * usuario y genera un código que se le dice o escribe a TURA. TURA queda
 * actuando como ese usuario, solo para consultar.
 */
export default function BusinessTuraDrawer({ business, onClose }: { business: Business | null; onClose: () => void }) {
  return business ? <TuraContent key={business.id} business={business} onClose={onClose} /> : null;
}

function TuraContent({ business, onClose }: { business: Business; onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = usePlatformTura(business.id);
  const { data: users = [] } = useBusinessUsers(business.id);
  const setFeature = useSetBusinessFeature(business.id);
  const generateCode = useGeneratePlatformTuraCode(business.id);
  const revokeLink = useRevokePlatformTuraLink(business.id);
  const [userId, setUserId] = useState('');
  const [code, setCode] = useState<(TuraLinkCode & { userName: string }) | null>(null);

  const activeUsers = users.filter((user) => user.status === 'ACTIVE');
  const showError = (error: unknown) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' });

  const enableModule = () =>
    setFeature.mutate(
      { featureKey: TURA_FEATURE, enabled: true },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: turaLinksKeys.platform(business.id) });
          enqueueSnackbar('TURA activada para la empresa', { variant: 'success' });
        },
        onError: showError,
      },
    );

  const generate = () => {
    const user = activeUsers.find((u) => u.id === userId);
    if (!user) return;
    generateCode.mutate(userId, {
      onSuccess: (result) => setCode({ ...result, userName: `${user.firstName} ${user.lastName}`.trim() }),
      onError: showError,
    });
  };

  return (
    <DetailDrawer open title="TURA (asistente)" subtitle={`${business.name} · vincular usuarios`} onClose={onClose} width={520}>
      {isLoading || !status ? (
        <LoadingSkeleton />
      ) : !status.enabled ? (
        <Stack spacing={2}>
          <Alert severity="info">
            Esta empresa no tiene el módulo TURA activo. Al activarlo, sus usuarios con permiso de configuración también
            podrán vincular TURA desde Configuración.
          </Alert>
          <Box>
            <Button variant="contained" loading={setFeature.isPending} onClick={enableModule}>
              Activar TURA
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Si no se activa, revisa que TURA esté encendida para toda la plataforma.
          </Typography>
        </Stack>
      ) : (
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            Elige el usuario con el que TURA va a actuar y genera un código. Ábrelo en la app de TURA y díselo o
            escríbelo cuando lo pida. TURA podrá consultar lo que ese usuario puede ver (ventas, pedidos, productos e
            inventario), pero no puede modificar nada.
          </Typography>

          {env.turaAppUrl && (
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <TuraAppQr url={env.turaAppUrl} />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  App de TURA
                </Typography>
                <Link href={env.turaAppUrl} target="_blank" rel="noopener" variant="body2">
                  {env.turaAppUrl.replace(/^https?:\/\//, '')}
                </Link>
                <Typography variant="caption" color="text.secondary" component="p">
                  Escanéalo con el celular donde se va a usar.
                </Typography>
              </Box>
            </Stack>
          )}

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
            <TextField
              select
              size="small"
              label="Usuario"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setCode(null);
              }}
              sx={{ flex: 1 }}
              helperText={activeUsers.length === 0 ? 'La empresa no tiene usuarios activos' : undefined}
            >
              {activeUsers.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} · {user.roleName}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="contained" disabled={!userId} loading={generateCode.isPending} onClick={generate}>
              Generar código
            </Button>
          </Stack>

          {code && (
            <Box sx={{ textAlign: 'center', py: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography
                component="p"
                sx={{ fontSize: 40, fontWeight: 700, letterSpacing: 8, fontVariantNumeric: 'tabular-nums' }}
              >
                {code.code}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Para {code.userName} · sirve una sola vez y vence a las{' '}
                {new Date(code.expiresAt).toLocaleTimeString('es-CO', { timeStyle: 'short' })}
              </Typography>
            </Box>
          )}

          <Divider />

          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Usuarios vinculados
              </Typography>
              <Button
                size="small"
                onClick={() => void queryClient.invalidateQueries({ queryKey: turaLinksKeys.platform(business.id) })}
              >
                Actualizar
              </Button>
            </Stack>
            {status.links.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Ningún usuario de esta empresa ha vinculado TURA todavía.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {status.links.map((link) => (
                  <Stack key={link.id} direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography sx={{ fontWeight: 600 }}>{link.userName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Vinculado el {formatDate(link.createdAt)} · Último uso: {formatDate(link.lastUsedAt)}
                      </Typography>
                    </Box>
                    <Button
                      color="error"
                      size="small"
                      loading={revokeLink.isPending && revokeLink.variables === link.id}
                      onClick={() =>
                        revokeLink.mutate(link.id, {
                          onSuccess: () => enqueueSnackbar('TURA desvinculada de ese usuario', { variant: 'success' }),
                          onError: showError,
                        })
                      }
                    >
                      Desvincular
                    </Button>
                  </Stack>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      )}
    </DetailDrawer>
  );
}
