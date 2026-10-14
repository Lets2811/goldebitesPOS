import { useMemo, useState } from 'react';
import ReactGridLayout, { useContainerWidth, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { GripVertical, Plus, RotateCcw, X } from 'lucide-react';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useFinanceDashboardStore, type WidgetPlacement } from '../../../store/financeDashboardStore';
import { brand } from '../../../theme/palette';
import { DEFAULT_LAYOUT, WIDGETS, WIDGETS_BY_ID, type WidgetContext } from './widgets';

const COLUMNS = 12;
const ROW_HEIGHT = 56;
const GAP = 16;
/** Por debajo de este ancho los widgets van uno bajo otro: una cuadrícula de 12 columnas no cabe en un teléfono. */
const STACKED_BELOW = 760;

interface FinanceDashboardProps {
  context: WidgetContext;
  /** En edición los widgets se arrastran, se estiran, se quitan y se agregan. */
  editing: boolean;
}

/** Solo lo que se guarda de cada widget, y solo los widgets que todavía existen. */
function toPlacements(layout: Layout): WidgetPlacement[] {
  return layout
    .filter((item) => WIDGETS_BY_ID.has(item.i))
    .map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
}

function WidgetFrame({
  title,
  editing,
  onRemove,
  children,
}: {
  title: string;
  editing: boolean;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        containerType: 'inline-size',
        ...(editing && { outline: `1px dashed ${alpha(brand.gold, 0.6)}` }),
      }}
    >
      <Stack
        direction="row"
        // Todo el encabezado sirve para arrastrar; el botón de quitar queda fuera.
        className={editing ? 'finance-widget__handle' : undefined}
        sx={{
          alignItems: 'center',
          gap: 0.5,
          px: 2,
          pt: 1.5,
          pb: 0.5,
          cursor: editing ? 'grab' : 'default',
          '&:active': { cursor: editing ? 'grabbing' : 'default' },
        }}
      >
        {editing && <GripVertical size={14} style={{ opacity: 0.6, flexShrink: 0 }} />}
        <Typography variant="overline" color="text.secondary" noWrap sx={{ flex: 1, lineHeight: 1.6 }}>
          {title}
        </Typography>
        {editing && (
          <Tooltip title="Quitar del panel">
            <IconButton
              size="small"
              className="finance-widget__remove"
              aria-label={`Quitar ${title}`}
              onClick={onRemove}
              sx={{ m: -0.5 }}
            >
              <X size={14} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 2, pb: 1.5 }}>{children}</Box>
    </Card>
  );
}

/**
 * El panel de Finanzas: una cuadrícula de widgets que cada persona arma a su
 * gusto. Lo que se ve es siempre lo guardado; al editar, cada cambio se guarda
 * en el momento.
 */
export default function FinanceDashboard({ context, editing }: FinanceDashboardProps) {
  const userId = useAuthStore((s) => s.user?.id ?? 'anonymous');
  const saved = useFinanceDashboardStore((s) => s.layouts[userId]);
  const setLayout = useFinanceDashboardStore((s) => s.setLayout);
  const resetLayout = useFinanceDashboardStore((s) => s.resetLayout);
  const { width, containerRef, mounted } = useContainerWidth();
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);

  // Un widget guardado que ya no existe se ignora; el mínimo de cada uno lo pone el catálogo, no lo guardado.
  const layout = useMemo(
    () =>
      (saved ?? DEFAULT_LAYOUT)
        .filter((item) => WIDGETS_BY_ID.has(item.i))
        .map((item) => {
          const { minW, minH } = WIDGETS_BY_ID.get(item.i)!.size;
          return { ...item, minW, minH };
        }),
    [saved],
  );
  const available = WIDGETS.filter((widget) => !layout.some((item) => item.i === widget.id));
  const stacked = width < STACKED_BELOW;

  function addWidget(id: string) {
    const { w, h } = WIDGETS_BY_ID.get(id)!.size;
    // Al final del panel; la cuadrícula lo acomoda arriba si hay hueco.
    const bottom = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    setLayout(userId, [...toPlacements(layout), { i: id, x: 0, y: bottom, w, h }]);
    setAddAnchor(null);
  }

  const removeWidget = (id: string) =>
    setLayout(
      userId,
      toPlacements(layout).filter((item) => item.i !== id),
    );

  const renderWidget = (id: string) => {
    const widget = WIDGETS_BY_ID.get(id)!;
    return (
      <WidgetFrame title={widget.title} editing={editing && !stacked} onRemove={() => removeWidget(id)}>
        {widget.render(context)}
      </WidgetFrame>
    );
  };

  return (
    <Box>
      {editing && (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            mb: 2,
            p: 1.5,
            alignItems: 'center',
            flexWrap: 'wrap',
            rowGap: 1,
            borderRadius: 2,
            border: `1px dashed ${alpha(brand.gold, 0.5)}`,
            backgroundColor: alpha(brand.gold, 0.06),
          }}
        >
          <Typography variant="body2" sx={{ flex: 1, minWidth: 220 }}>
            {stacked
              ? 'Para mover y cambiar el tamaño de los widgets usa una pantalla más ancha. Aquí puedes agregarlos.'
              : 'Arrastra un widget por su título para moverlo y estíralo desde la esquina inferior derecha.'}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Plus size={16} />}
            disabled={available.length === 0}
            onClick={(event) => setAddAnchor(event.currentTarget)}
          >
            Agregar widget
          </Button>
          <Button size="small" startIcon={<RotateCcw size={16} />} onClick={() => resetLayout(userId)}>
            Restablecer
          </Button>
          <Menu anchorEl={addAnchor} open={Boolean(addAnchor)} onClose={() => setAddAnchor(null)}>
            {available.map((widget) => (
              <MenuItem key={widget.id} onClick={() => addWidget(widget.id)} sx={{ maxWidth: 360 }}>
                <ListItemText
                  primary={widget.title}
                  secondary={widget.description}
                  slotProps={{ secondary: { sx: { whiteSpace: 'normal' } } }}
                />
              </MenuItem>
            ))}
          </Menu>
        </Stack>
      )}

      {layout.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
          El panel está vacío. Usa "Personalizar" para agregar widgets.
        </Typography>
      )}

      <Box
        ref={containerRef}
        sx={{
          // El hueco donde caerá el widget que se arrastra, en el color de la marca.
          '& .react-grid-placeholder': {
            backgroundColor: alpha(brand.gold, 0.25),
            borderRadius: 2,
            opacity: 1,
          },
          // La esquina para estirar, visible sobre el fondo oscuro.
          '& .react-resizable-handle': { backgroundImage: 'none', width: 22, height: 22 },
          '& .react-resizable-handle::after': {
            content: '""',
            position: 'absolute',
            right: 5,
            bottom: 5,
            width: 9,
            height: 9,
            borderRight: `2px solid ${brand.gold}`,
            borderBottom: `2px solid ${brand.gold}`,
          },
        }}
      >
        {mounted &&
          (stacked ? (
            <Stack spacing={2}>
              {layout.map((item) => (
                // Apilados, cada widget conserva la altura que tiene en la cuadrícula.
                <Box key={item.i} sx={{ height: item.h * ROW_HEIGHT + (item.h - 1) * GAP }}>
                  {renderWidget(item.i)}
                </Box>
              ))}
            </Stack>
          ) : (
            <ReactGridLayout
              layout={layout}
              width={width}
              gridConfig={{ cols: COLUMNS, rowHeight: ROW_HEIGHT, margin: [GAP, GAP], containerPadding: [0, 0] }}
              dragConfig={{
                enabled: editing,
                handle: '.finance-widget__handle',
                cancel: '.finance-widget__remove',
              }}
              resizeConfig={{ enabled: editing, handles: ['se'] }}
              onLayoutChange={(next) => {
                // La cuadrícula avisa también al montarse; solo se guarda lo que la persona cambió.
                if (editing) setLayout(userId, toPlacements(next));
              }}
            >
              {layout.map((item) => (
                <div key={item.i}>{renderWidget(item.i)}</div>
              ))}
            </ReactGridLayout>
          ))}
      </Box>
    </Box>
  );
}
