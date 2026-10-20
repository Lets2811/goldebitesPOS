import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import { PackagePlus, Pencil, Power } from 'lucide-react';
import DetailDrawer from '../../../components/common/DetailDrawer';
import StatusChip from '../../../components/common/StatusChip';
import DateDisplay from '../../../components/common/DateDisplay';
import { Can } from '../../../modules/auth/components/can';
import { useMovements } from '../../../modules/inventory/hooks/use-movements';
import { formatCOP } from '../../../utils/format';
import type {
  InventoryItem,
  InventoryMovementType,
} from '../../../modules/inventory/types/inventory.types';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useAllBranchesReview } from '../../../modules/auth/hooks/use-branch-mode';
import InventoryBranchesSection from './InventoryBranchesSection';

interface InventoryDetailDrawerProps {
  item: InventoryItem | null;
  categoryName: string | null;
  currentStock: number;
  /** The minimum the item is held to where the session works (the branch's own, or the general one). */
  minimumStock?: number;
  onClose: () => void;
  onRegisterMovement: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
  onToggleStatus: (item: InventoryItem) => void;
}

const MOVEMENT_TYPE_LABELS: Record<InventoryMovementType, string> = {
  PURCHASE: 'Compra',
  SALE_CONSUMPTION: 'Consumo por venta',
  WASTE: 'Merma',
  ADJUSTMENT_IN: 'Ajuste (entrada)',
  ADJUSTMENT_OUT: 'Ajuste (salida)',
  TRANSFER_IN: 'Traslado (entrada)',
  TRANSFER_OUT: 'Traslado (salida)',
  RETURN: 'Devolución',
  INITIAL_STOCK: 'Stock inicial',
};

const OUTBOUND_TYPES: InventoryMovementType[] = [
  'SALE_CONSUMPTION',
  'WASTE',
  'ADJUSTMENT_OUT',
  'TRANSFER_OUT',
];

export default function InventoryDetailDrawer({
  item,
  categoryName,
  currentStock,
  minimumStock,
  onClose,
  onRegisterMovement,
  onEdit,
  onToggleStatus,
}: InventoryDetailDrawerProps) {
  const branchId = useAuthStore((s) => s.user?.branchId ?? undefined);
  const reviewOnly = useAllBranchesReview();
  // The branch's own movements (all of them in "Todas las sedes").
  const { data: movementsData } = useMovements({ inventoryItemId: item?.id, branchId, limit: 15 });
  const movements = movementsData?.data ?? [];

  if (!item) return null;

  const minimum = minimumStock ?? item.minimumStock;
  const isLow = currentStock <= minimum;

  return (
    <DetailDrawer
      open={Boolean(item)}
      onClose={onClose}
      title={item.name}
      subtitle={
        [item.sku ? `Referencia: ${item.sku}` : null, categoryName].filter(Boolean).join(' · ') ||
        undefined
      }
      headerExtra={
        <StatusChip
          label={item.isActive ? 'Activo' : 'Inactivo'}
          tone={item.isActive ? 'success' : 'neutral'}
        />
      }
      footer={
        <Can permission="inventory.manage">
          <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
            <Button startIcon={<Power size={16} />} onClick={() => onToggleStatus(item)}>
              {item.isActive ? 'Desactivar' : 'Activar'}
            </Button>
            <Button startIcon={<Pencil size={16} />} onClick={() => onEdit(item)}>
              Editar
            </Button>
            {/* Stock moves at a branch: not from "Todas las sedes". */}
            {!reviewOnly && (
              <Button
                variant="contained"
                startIcon={<PackagePlus size={16} />}
                onClick={() => onRegisterMovement(item)}
              >
                Ajustar stock
              </Button>
            )}
          </Stack>
        </Can>
      }
    >
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Stock actual
            </Typography>
            <Typography
              variant="body2"
              color={isLow ? 'error.main' : 'text.primary'}
              sx={{ fontWeight: 700 }}
            >
              {currentStock} {item.unit}
            </Typography>
          </Stack>
          {isLow && <StatusChip label="Stock bajo el mínimo" tone="warning" />}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Mínimo: {minimum} {item.unit}
          </Typography>
        </Box>

        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Costo actual
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 700 }}>
              {formatCOP(item.currentCost)}
              <Typography component="span" variant="caption" color="text.secondary">
                {' '}
                / {item.unit}
              </Typography>
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Valor en inventario
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 700 }}>
              {formatCOP(item.currentCost * currentStock)}
            </Typography>
          </Box>
        </Stack>

        {(item.brand || item.model || item.serialNumber) && (
          <>
            <Divider />
            <Stack direction="row" spacing={2}>
              {item.brand && (
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Marca
                  </Typography>
                  <Typography variant="body2">{item.brand}</Typography>
                </Box>
              )}
              {item.model && (
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Modelo
                  </Typography>
                  <Typography variant="body2">{item.model}</Typography>
                </Box>
              )}
              {item.serialNumber && (
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Serial
                  </Typography>
                  <Typography variant="body2">{item.serialNumber}</Typography>
                </Box>
              )}
            </Stack>
          </>
        )}

        <InventoryBranchesSection item={item} />

        <Divider />

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Historial de movimientos
          </Typography>
          {movements.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Sin movimientos registrados aún.
            </Typography>
          ) : (
            <Stack spacing={1.25}>
              {movements.map((m) => {
                const isOutbound = OUTBOUND_TYPES.includes(m.movementType);
                return (
                  <Stack
                    key={m.id}
                    direction="row"
                    sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {MOVEMENT_TYPE_LABELS[m.movementType]}
                      </Typography>
                      {m.notes && (
                        <Typography variant="caption" color="text.secondary">
                          {m.notes}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography
                        variant="body2"
                        color={isOutbound ? 'error.main' : 'success.main'}
                        sx={{ fontWeight: 700 }}
                      >
                        {isOutbound ? '-' : '+'}
                        {m.quantity} {item.unit}
                      </Typography>
                      <DateDisplay
                        value={m.createdAt}
                        mode="datetime"
                        variant="caption"
                        color="text.secondary"
                      />
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Box>
      </Stack>
    </DetailDrawer>
  );
}
