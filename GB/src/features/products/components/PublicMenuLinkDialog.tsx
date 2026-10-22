import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Copy, Check, ExternalLink, MessageCircle, Share2 } from 'lucide-react';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useComboBuilderName } from '../../../modules/products/combo-builder';

interface PublicMenuLinkDialogProps {
  open: boolean;
  businessId: string | undefined;
  /** Para el texto del mensaje que acompaña al enlace. */
  businessName?: string;
  onClose: () => void;
}

/**
 * Un número colombiano escrito sin indicativo (10 dígitos que empiezan por 3)
 * recibe el 57; cualquier otro se usa tal cual, así que uno extranjero se
 * escribe con su indicativo.
 */
function toWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 10 && digits.startsWith('3') ? `57${digits}` : digits;
}

/**
 * El enlace público del menú: lo abre cualquiera, sin iniciar sesión. Es solo
 * de consulta — no identifica una mesa ni permite pedir; para eso están los
 * enlaces de los gallos NFC.
 */
export default function PublicMenuLinkDialog({
  open,
  businessId,
  businessName,
  onClose,
}: PublicMenuLinkDialogProps) {
  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState('');
  // The menu of the branch the session is at (what it offers, at its prices).
  const branchId = useAuthStore((s) => s.user?.branchId ?? null);
  // The whole menu, or straight to "Arma tu combo" (its own address).
  const comboName = useComboBuilderName();
  const [target, setTarget] = useState<'menu' | 'combo'>('menu');
  const link = businessId
    ? `${window.location.origin}/menu/${businessId}${target === 'combo' ? '/combo' : ''}${
        branchId ? `?sede=${branchId}` : ''
      }`
    : '';
  const message =
    target === 'combo'
      ? businessName
        ? `${comboName} en ${businessName}: ${link}`
        : `${comboName}: ${link}`
      : businessName
        ? `Te compartimos el menú de ${businessName}: ${link}`
        : `Te compartimos nuestro menú: ${link}`;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Sin número, WhatsApp deja elegir el contacto.
  const handleWhatsApp = () => {
    if (!link) return;
    const number = toWhatsAppNumber(phone);
    window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const handleNativeShare = () => {
    if (!link) return;
    // El usuario puede cerrar la hoja de compartir sin elegir nada; no es un error.
    navigator
      .share({ title: businessName ? `Menú de ${businessName}` : 'Menú', text: message, url: link })
      .catch(() => {});
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Compartir menú</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enlace público del menú: lo puede abrir cualquier persona, sin iniciar sesión. Muestra los
          productos activos y visibles con precio y descripción, y se actualiza solo cuando cambias
          el catálogo. Es solo de consulta: no identifica una mesa ni permite pedir.
        </Typography>
        <Stack spacing={2}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={target}
            onChange={(_e, value: 'menu' | 'combo' | null) => value && setTarget(value)}
          >
            <ToggleButton value="menu">Menú completo</ToggleButton>
            <ToggleButton value="combo">{comboName}</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            fullWidth
            label="Enlace"
            value={link}
            slotProps={{ htmlInput: { readOnly: true } }}
            onFocus={(e) => e.target.select()}
          />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ alignItems: { sm: 'flex-start' } }}
          >
            <TextField
              fullWidth
              label="WhatsApp del cliente (opcional)"
              placeholder="300 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              helperText="Déjalo vacío para elegir el contacto en WhatsApp."
              slotProps={{ htmlInput: { inputMode: 'tel' } }}
            />
            <Button
              variant="contained"
              color="success"
              startIcon={<MessageCircle size={16} />}
              onClick={handleWhatsApp}
              sx={{ flexShrink: 0, height: 56, fontWeight: 700 }}
            >
              Enviar por WhatsApp
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          startIcon={<ExternalLink size={16} />}
          onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}
        >
          Abrir
        </Button>
        {canNativeShare && (
          <Button startIcon={<Share2 size={16} />} onClick={handleNativeShare}>
            Compartir
          </Button>
        )}
        <Button
          variant="contained"
          startIcon={copied ? <Check size={16} /> : <Copy size={16} />}
          onClick={handleCopy}
        >
          {copied ? 'Copiado' : 'Copiar enlace'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
