import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { ImagePlus, Trash2, UtensilsCrossed } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { brand } from '../../../theme/palette';
import { shrinkImage } from '../../../utils/shrink-image';

/** What to do with the product's photo when the form is saved. */
export type ProductImageChange =
  | { kind: 'keep' }
  | { kind: 'set'; file: File; previewUrl: string }
  | { kind: 'remove' };

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

interface ProductImageFieldProps {
  /** The photo the product has now, if any. */
  currentUrl: string | null;
  change: ProductImageChange;
  onChange: (change: ProductImageChange) => void;
}

/**
 * La foto del producto: la que ve el cliente en el menú y el personal en el
 * punto de venta. Se reduce en el navegador antes de subirla.
 */
export default function ProductImageField({ currentUrl, change, onChange }: ProductImageFieldProps) {
  const { enqueueSnackbar } = useSnackbar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);

  const shownUrl = change.kind === 'set' ? change.previewUrl : change.kind === 'remove' ? null : currentUrl;

  const replace = (next: ProductImageChange) => {
    if (change.kind === 'set') URL.revokeObjectURL(change.previewUrl);
    onChange(next);
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      enqueueSnackbar('Solo se permiten imágenes JPG, PNG o WEBP.', { variant: 'error' });
      return;
    }
    setPreparing(true);
    try {
      const shrunk = await shrinkImage(file);
      replace({ kind: 'set', file: shrunk, previewUrl: URL.createObjectURL(shrunk) });
    } catch {
      enqueueSnackbar('No se pudo leer esa imagen. Prueba con otra.', { variant: 'error' });
    } finally {
      setPreparing(false);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        Foto
      </Typography>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Box
          sx={{
            width: 112,
            height: 112,
            flexShrink: 0,
            borderRadius: 2,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(brand.gold, 0.08),
            border: '1px dashed',
            borderColor: shownUrl ? 'transparent' : alpha(brand.gold, 0.4),
          }}
        >
          {preparing ? (
            <CircularProgress size={24} />
          ) : shownUrl ? (
            <Box
              component="img"
              src={shownUrl}
              alt="Foto del producto"
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <UtensilsCrossed size={32} color={brand.gold} strokeWidth={1.5} />
          )}
        </Box>
        <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ImagePlus size={16} />}
            disabled={preparing}
            onClick={() => inputRef.current?.click()}
          >
            {shownUrl ? 'Cambiar foto' : 'Subir foto'}
          </Button>
          {shownUrl && (
            <Button
              size="small"
              color="error"
              startIcon={<Trash2 size={16} />}
              disabled={preparing}
              onClick={() => replace(currentUrl ? { kind: 'remove' } : { kind: 'keep' })}
            >
              Quitar foto
            </Button>
          )}
          <Typography variant="caption" color="text.secondary">
            JPG, PNG o WEBP. Se ve en el menú del cliente y en el punto de venta.
          </Typography>
        </Stack>
      </Stack>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        hidden
        data-testid="product-image-input"
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          // Choosing the same file again still fires onChange.
          event.target.value = '';
        }}
      />
    </Box>
  );
}
