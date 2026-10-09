import { useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { ChevronDown } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { normalizeApiError } from '../../../lib/api/api-error';
import {
  useGenerateTuraLinkCode,
  useRevokeTuraLink,
  useTuraLinks,
} from '../../../modules/tura-links/hooks/use-tura-links';
import type { TuraLinkCode } from '../../../modules/tura-links/types/tura-link.types';

function formatDate(value: string | null): string {
  return value
    ? new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Nunca';
}

/**
 * Links between this business's users and TURA, the assistant app. A link is
 * created by generating a code here and saying or typing it to TURA, which
 * from then on acts as the user who generated it: it can read (never change)
 * what that user is allowed to see. Rendered only for businesses that have
 * the TURA module and for settings.manage, which every endpoint behind it
 * requires.
 */
export default function TuraLinksSection() {
  const { enqueueSnackbar } = useSnackbar();
  const { data: links = [], refetch } = useTuraLinks();
  const generateCode = useGenerateTuraLinkCode();
  const revokeLink = useRevokeTuraLink();
  const [code, setCode] = useState<TuraLinkCode | null>(null);

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ChevronDown size={18} />}>
        <Typography sx={{ fontWeight: 700 }}>TURA (asistente)</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            Para conectar TURA con tu usuario, genera un código y díselo o escríbeselo cuando te lo
            pida. TURA quedará vinculada a ti: podrá consultar lo que tú puedes ver (ventas, pedidos
            e inventario), pero no puede modificar nada.
          </Typography>

          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
            <Button
              variant="outlined"
              loading={generateCode.isPending}
              onClick={() =>
                generateCode.mutate(undefined, {
                  onSuccess: setCode,
                  onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
                })
              }
            >
              Generar código
            </Button>
            {code && (
              <Box>
                <Typography
                  component="p"
                  sx={{ fontSize: 32, fontWeight: 700, letterSpacing: 6, fontVariantNumeric: 'tabular-nums' }}
                >
                  {code.code}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Sirve una sola vez y vence a las{' '}
                  {new Date(code.expiresAt).toLocaleTimeString('es-CO', { timeStyle: 'short' })}.
                </Typography>
              </Box>
            )}
          </Stack>

          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Usuarios vinculados
              </Typography>
              <Button size="small" onClick={() => void refetch()}>
                Actualizar
              </Button>
            </Stack>
            {links.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Ningún usuario ha vinculado TURA todavía.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {links.map((link) => (
                  <Stack
                    key={link.id}
                    direction="row"
                    spacing={2}
                    sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                  >
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
                          onError: (error) =>
                            enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
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
      </AccordionDetails>
    </Accordion>
  );
}
