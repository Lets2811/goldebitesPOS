import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Check, Copy, ExternalLink, MessageCircle } from 'lucide-react';

interface TuraCodeCardProps {
  code: string;
  expiresAt: string;
  /** TURA's app; empty where it is not deployed (then only the code is shown). */
  turaAppUrl: string;
  /** Whose the link will be, when it is generated for someone else. */
  userName?: string;
}

/** The address that opens TURA and links it with this code, no typing. */
function turaLinkUrl(turaAppUrl: string, code: string): string {
  return `${turaAppUrl.replace(/\/+$/, '')}/?vincular=${code}`;
}

/**
 * A TURA link code, ready to use: scanned as a QR, opened or sent as a link
 * (TURA links itself on opening), or said or typed as six digits.
 */
export default function TuraCodeCard({ code, expiresAt, turaAppUrl, userName }: TuraCodeCardProps) {
  const url = turaAppUrl ? turaLinkUrl(turaAppUrl, code) : '';
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const until = new Date(expiresAt).toLocaleTimeString('es-CO', { timeStyle: 'short' });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void import('qrcode').then((QRCode) =>
      QRCode.toDataURL(url, { margin: 1, width: 240 }).then((value) => {
        if (!cancelled) setQr(value);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  const message = `Conecta TURA, tu asistente: abre este enlace en tu celular (sirve una vez y vence a las ${until}). ${url}`;

  return (
    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} sx={{ alignItems: 'center' }}>
        {qr && (
          <Box
            component="img"
            src={qr}
            alt="QR para conectar TURA"
            sx={{ width: 168, height: 168, borderRadius: 1.5, bgcolor: '#fff', flexShrink: 0 }}
          />
        )}
        <Stack
          spacing={1}
          sx={{
            alignItems: { xs: 'center', sm: 'flex-start' },
            textAlign: { xs: 'center', sm: 'left' },
          }}
        >
          {url && (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Escanéalo con la cámara del celular{userName ? ` de ${userName}` : ''}: TURA se abre y
              queda conectada.
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {url ? 'O díselo o escríbeselo a TURA:' : 'Díselo o escríbeselo a TURA cuando lo pida:'}
          </Typography>
          <Typography
            component="p"
            sx={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: 6,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1,
            }}
          >
            {code}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {userName ? `Para ${userName} · ` : ''}Sirve una sola vez y vence a las {until}.
          </Typography>
          {url && (
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', pt: 0.5 }}>
              <Button
                size="small"
                variant="contained"
                color="success"
                startIcon={<MessageCircle size={15} />}
                onClick={() =>
                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(message)}`,
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
              >
                Enviar por WhatsApp
              </Button>
              <Button
                size="small"
                startIcon={copied ? <Check size={15} /> : <Copy size={15} />}
                onClick={() => {
                  void navigator.clipboard.writeText(url).then(() => setCopied(true));
                }}
              >
                {copied ? 'Copiado' : 'Copiar enlace'}
              </Button>
              <Button
                size="small"
                startIcon={<ExternalLink size={15} />}
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
              >
                Abrir aquí
              </Button>
            </Stack>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
