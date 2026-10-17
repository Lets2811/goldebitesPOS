import { useMemo, useRef, useState } from 'react';
import ReactGridLayout, { useContainerWidth, type Compactor, type Layout } from 'react-grid-layout';
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
import { flowLayout, readingOrder, type FlowSize } from './flow-layout';
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

/**
 * Lo que se guarda: los widgets en orden, cada uno con el tamaño que eligió
 * la persona (sin lo que se estiró para llenar su fila), y su lugar.
 */
function toPlacements(sizes: readonly FlowSize[]): WidgetPlacement[] {
  const byId = new Map(sizes.map((size) => [size.i, size]));
  return flowLayout(sizes, COLUMNS, { stretch: true }).map(({ i, x, y }) => ({ i, x, y, ...sizeOf(byId.get(i)!) }));
}

const sizeOf = ({ w, h }: { w: number; h: number }) => ({ w, h });

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

  // Los widgets en su orden, con el tamaño elegido. Un widget guardado que ya no existe se ignora.
  const sizes = useMemo<FlowSize[]>(
    () =>
      readingOrder((saved ?? DEFAULT_LAYOUT).filter((item) => WIDGETS_BY_ID.has(item.i))).map(({ i, w, h }) => ({
        i,
        w,
        h,
      })),
    [saved],
  );
  // Lo que se dibuja: acomodado sin huecos. El mínimo de cada uno lo pone el catálogo, no lo guardado.
  const layout = useMemo(
    () =>
      flowLayout(sizes, COLUMNS, { stretch: true }).map((item) => {
        const { minW, minH } = WIDGETS_BY_ID.get(item.i)!.size;
        return { ...item, minW, minH };
      }),
    [sizes],
  );
  const available = WIDGETS.filter((widget) => !sizes.some((item) => item.i === widget.id));
  const stacked = width < STACKED_BELOW;

  // La cuadrícula acomoda en vivo mientras se arrastra o se estira, con este mismo orden de lectura.
  /** El widget que se está estirando: su tamaño es el que marca el puntero, y su fila no se estira mientras tanto. */
  const resizingRef = useRef<string | null>(null);
  const compactor = useMemo<Compactor>(
    () => ({
      type: 'vertical',
      // Lo arrastrado no empuja a nadie: solo cambia el orden, y el acomodo hace el resto.
      allowOverlap: true,
      compact(current, cols) {
        const chosen = new Map(sizes.map((size) => [size.i, size]));
        const ordered = readingOrder(current).map((item) => ({
          i: item.i,
          ...sizeOf(item.i === resizingRef.current ? item : (chosen.get(item.i) ?? item)),
        }));
        const placed = new Map(
          flowLayout(ordered, cols, { stretch: resizingRef.current === null }).map((item) => [item.i, item]),
        );
        return current.map((item) => ({ ...item, ...placed.get(item.i), moved: false }));
      },
    }),
    [sizes],
  );

  /** Guarda el orden que dejó la cuadrícula al soltar, con el tamaño elegido de cada widget. */
  function saveOrder(next: Layout, resized?: { i: string; w: number; h: number }) {
    const chosen = new Map(sizes.map((size) => [size.i, size]));
    setLayout(
      userId,
      toPlacements(
        readingOrder(next)
          .filter((item) => chosen.has(item.i))
          .map((item) => ({ i: item.i, ...sizeOf(item.i === resized?.i ? resized : chosen.get(item.i)!) })),
      ),
    );
  }

  function addWidget(id: string) {
    // Al final del panel, con su tamaño de fábrica.
    setLayout(userId, toPlacements([...sizes, { i: id, ...sizeOf(WIDGETS_BY_ID.get(id)!.size) }]));
    setAddAnchor(null);
  }

  // Los demás se reacomodan solos y su fila se estira: no queda el hueco.
  const removeWidget = (id: string) =>
    setLayout(
      userId,
      toPlacements(sizes.filter((item) => item.i !== id)),
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
              : 'Arrastra un widget por su título para cambiarlo de lugar; los demás se reacomodan solos. Estíralo desde la esquina inferior derecha.'}
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
              compactor={compactor}
              // Solo se guarda al soltar: lo de en medio es la vista previa del acomodo.
              onDragStop={(next) => saveOrder(next)}
              onResizeStart={(_, item) => {
                resizingRef.current = item?.i ?? null;
              }}
              onResizeStop={(next, _, item) => {
                resizingRef.current = null;
                saveOrder(next, item ?? undefined);
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
