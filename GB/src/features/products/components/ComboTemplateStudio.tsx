import { useEffect, useMemo, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Download,
  Monitor,
  RotateCcw,
  Smartphone,
  Tablet,
  UtensilsCrossed,
  X,
  XCircle,
} from 'lucide-react';
import { useSnackbar } from 'notistack';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import type { PublicMenu } from '../../../modules/public-menu/types/public-menu.types';
import { brand } from '../../../theme/palette';
import ComboBuilderView from '../../public-menu/components/ComboBuilderView';
import {
  lintComboTemplate,
  type TemplateNotice,
} from '../../public-menu/combo-template/combo-template-lint';

type Device = 'phone' | 'tablet' | 'desktop';

/** Each device's screen, as the customer's would be. */
const DEVICES: Record<
  Device,
  { label: string; width: number | null; height: number; icon: typeof Smartphone }
> = {
  phone: { label: 'Celular', width: 390, height: 780, icon: Smartphone },
  tablet: { label: 'Tablet', width: 768, height: 960, icon: Tablet },
  desktop: { label: 'Escritorio', width: null, height: 820, icon: Monitor },
};

const NOTICE_ICON = { error: XCircle, warning: AlertTriangle, ok: CheckCircle2 } as const;
const NOTICE_COLOR = { error: 'error.main', warning: 'warning.main', ok: 'success.main' } as const;

interface ComboTemplateStudioProps {
  open: boolean;
  /** What it opens with: the saved template, an uploaded file, or the example. */
  initialHtml: string;
  /** The template customers see now (null: the default view), to tell what changed. */
  savedHtml: string | null;
  menu: PublicMenu | undefined;
  canEdit: boolean;
  saving: boolean;
  onSave: (html: string) => void;
  onDownload: (html: string) => void;
  onClose: () => void;
}

/**
 * Editing an "Arma tu combo" template while seeing it: the HTML on one side,
 * the page as a customer gets it on the other (in a phone, tablet or desktop
 * screen, ordering or browse-only, with the real products), and what the
 * template is missing or gets wrong. The preview follows the typing.
 */
export default function ComboTemplateStudio({
  open,
  initialHtml,
  savedHtml,
  menu,
  canEdit,
  saving,
  onSave,
  onDownload,
  onClose,
}: ComboTemplateStudioProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [html, setHtml] = useState(initialHtml);
  const [previewHtml, setPreviewHtml] = useState(initialHtml);
  const [device, setDevice] = useState<Device>('phone');
  const [readOnly, setReadOnly] = useState(false);
  const [showCode, setShowCode] = useState(true);
  const [confirmClose, setConfirmClose] = useState(false);

  // Each opening starts from what it was opened with.
  const [openedWith, setOpenedWith] = useState<string | null>(null);
  if (open && openedWith !== initialHtml) {
    setOpenedWith(initialHtml);
    setHtml(initialHtml);
    setPreviewHtml(initialHtml);
  }
  if (!open && openedWith !== null) setOpenedWith(null);

  // The preview catches up a moment after the typing stops.
  useEffect(() => {
    const timer = setTimeout(() => setPreviewHtml(html), 400);
    return () => clearTimeout(timer);
  }, [html]);

  const counts = useMemo(() => {
    const sections = (menu?.builderCategories ?? []).filter(
      (category) => category.products.length > 0,
    );
    return {
      sections: sections.length,
      products: sections.reduce((sum, s) => sum + s.products.length, 0),
    };
  }, [menu]);
  const notices: TemplateNotice[] = useMemo(
    () =>
      lintComboTemplate(
        previewHtml,
        new DOMParser().parseFromString(previewHtml, 'text/html'),
        counts,
      ),
    [previewHtml, counts],
  );
  const hasErrors = notices.some((notice) => notice.level === 'error');
  const dirty = html !== (savedHtml ?? '');

  const close = () => (dirty && canEdit ? setConfirmClose(true) : onClose());
  const screen = DEVICES[device];

  return (
    <Dialog fullScreen open={open} onClose={close}>
      <AppBar
        position="relative"
        color="default"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar sx={{ gap: 1.5, flexWrap: 'wrap', py: 1 }}>
          <IconButton edge="start" onClick={close} aria-label="Cerrar">
            <X size={20} />
          </IconButton>
          <Typography variant="h6" sx={{ fontWeight: 800, mr: 'auto' }}>
            Plantilla de «{menu?.builderName ?? 'Arma tu combo'}»
            {dirty && canEdit && (
              <Typography component="span" variant="caption" color="warning.main" sx={{ ml: 1 }}>
                · cambios sin guardar
              </Typography>
            )}
          </Typography>

          <ToggleButtonGroup
            exclusive
            size="small"
            value={device}
            onChange={(_e, value: Device | null) => value && setDevice(value)}
          >
            {(Object.keys(DEVICES) as Device[]).map((key) => {
              const Icon = DEVICES[key].icon;
              return (
                <ToggleButton key={key} value={key} sx={{ gap: 0.75 }}>
                  <Icon size={15} /> {DEVICES[key].label}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={readOnly ? 'browse' : 'order'}
            onChange={(_e, value) => value && setReadOnly(value === 'browse')}
          >
            <Tooltip title="Como lo ve el cliente en la mesa con autoservicio">
              <ToggleButton value="order">Pide</ToggleButton>
            </Tooltip>
            <Tooltip title="Como se ve desde el enlace público o una mesa sin autoservicio">
              <ToggleButton value="browse">Solo consulta</ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
          <ToggleButton
            size="small"
            value="code"
            selected={showCode}
            onChange={() => setShowCode((v) => !v)}
            sx={{ gap: 0.75 }}
          >
            <Code2 size={15} /> Código
          </ToggleButton>

          <Button startIcon={<Download size={16} />} onClick={() => onDownload(html)}>
            Descargar
          </Button>
          {canEdit && (
            <Tooltip title={hasErrors ? 'Corrige los errores para poder guardar' : ''}>
              <span>
                <Button
                  variant="contained"
                  disabled={!dirty || hasErrors}
                  loading={saving}
                  onClick={() => onSave(html)}
                >
                  Guardar
                </Button>
              </span>
            </Tooltip>
          )}
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: showCode ? 'minmax(380px, 42%) 1fr' : '1fr' },
        }}
      >
        {showCode && (
          <Stack sx={{ minHeight: 0, borderRight: { lg: 1 }, borderColor: 'divider' }}>
            <Stack direction="row" sx={{ alignItems: 'center', px: 2, py: 1, gap: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
                HTML de la plantilla
              </Typography>
              {canEdit && savedHtml !== null && html !== savedHtml && (
                <Button
                  size="small"
                  startIcon={<RotateCcw size={14} />}
                  onClick={() => setHtml(savedHtml)}
                >
                  Volver a la guardada
                </Button>
              )}
              <Typography variant="caption" color="text.secondary">
                {Math.round(html.length / 100) / 10} KB
              </Typography>
            </Stack>
            <TextField
              multiline
              fullWidth
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              disabled={!canEdit}
              onKeyDown={(e) => {
                // Tab indents instead of leaving the editor.
                if (e.key !== 'Tab') return;
                e.preventDefault();
                const target = e.target as HTMLTextAreaElement;
                const { selectionStart, selectionEnd } = target;
                const next = `${html.slice(0, selectionStart)}  ${html.slice(selectionEnd)}`;
                setHtml(next);
                requestAnimationFrame(() =>
                  target.setSelectionRange(selectionStart + 2, selectionStart + 2),
                );
              }}
              slotProps={{
                htmlInput: { spellCheck: false, 'aria-label': 'HTML de la plantilla' },
                input: {
                  sx: {
                    alignItems: 'flex-start',
                    height: '100%',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    fontSize: 13,
                    lineHeight: 1.55,
                    '& textarea': { height: '100% !important', overflow: 'auto !important' },
                  },
                },
              }}
              sx={{ flex: 1, minHeight: 280, px: 2, '& .MuiInputBase-root': { height: '100%' } }}
            />
            <Box
              sx={{
                px: 2,
                py: 1.5,
                maxHeight: 220,
                overflowY: 'auto',
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Revisión
              </Typography>
              <Stack spacing={0.75}>
                {notices.map((notice, index) => {
                  const Icon = NOTICE_ICON[notice.level];
                  return (
                    <Stack
                      key={index}
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'flex-start' }}
                    >
                      <Box sx={{ color: NOTICE_COLOR[notice.level], mt: '2px', flexShrink: 0 }}>
                        <Icon size={15} />
                      </Box>
                      <Typography variant="body2">{notice.message}</Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </Box>
          </Stack>
        )}

        <Box
          sx={{
            minHeight: 0,
            overflow: 'auto',
            p: { xs: 2, md: 4 },
            bgcolor: (theme) => alpha(theme.palette.text.primary, 0.04),
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
          }}
        >
          <Box
            sx={{
              width: screen.width ? `${screen.width}px` : '100%',
              maxWidth: '100%',
              height: screen.height,
              flexShrink: 0,
              borderRadius: device === 'desktop' ? 2 : device === 'phone' ? 6 : 4,
              border: device === 'desktop' ? 1 : 10,
              borderColor: device === 'desktop' ? 'divider' : '#1b1b1f',
              boxShadow: 8,
              overflow: 'hidden',
              bgcolor: 'background.default',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* The customer's screen: it scrolls on its own, the "Tu combo" bar sticks to its bottom. */}
            <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pt: 3 }}>
              {menu ? (
                <>
                  <Stack sx={{ alignItems: 'center', textAlign: 'center', mb: 3 }} spacing={0.5}>
                    <UtensilsCrossed size={24} color={brand.gold} strokeWidth={1.75} />
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      {menu.businessName}
                    </Typography>
                  </Stack>
                  <ComboBuilderView
                    title={menu.builderName}
                    description={menu.builderDescription}
                    categories={menu.builderCategories}
                    optionGroups={menu.optionGroups}
                    readOnly={readOnly}
                    template={previewHtml}
                    onBack={() =>
                      enqueueSnackbar('En la página real, este botón vuelve al menú.', {
                        variant: 'info',
                      })
                    }
                    onAddCombo={() =>
                      enqueueSnackbar(
                        'Es una vista previa: el combo se armó bien, pero no se pide nada.',
                        { variant: 'info' },
                      )
                    }
                  />
                </>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textAlign: 'center', mt: 6 }}
                >
                  Cargando los productos…
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      <ConfirmDialog
        open={confirmClose}
        title="¿Salir sin guardar?"
        description="Los cambios a la plantilla se pierden. Lo que ven tus clientes no cambia."
        confirmLabel="Salir sin guardar"
        destructive
        onConfirm={() => {
          setConfirmClose(false);
          onClose();
        }}
        onClose={() => setConfirmClose(false)}
      />
    </Dialog>
  );
}
