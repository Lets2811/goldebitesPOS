import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import StatusChip from '../../../components/common/StatusChip';
import { normalizeApiError } from '../../../lib/api/api-error';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import {
  useItemBranches,
  useSetItemBranchMinimum,
  type InventoryItemAtBranch,
} from '../../../modules/inventory/branch-minimums';
import type { InventoryItem } from '../../../modules/inventory/types/inventory.types';

function BranchRow({
  item,
  branch,
  editable,
}: {
  item: InventoryItem;
  branch: InventoryItemAtBranch;
  editable: boolean;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const setMinimum = useSetItemBranchMinimum();
  const [value, setValue] = useState(
    branch.minimumStock === null ? '' : String(branch.minimumStock),
  );
  const parsed = value.trim() === '' ? null : Number(value.replace(',', '.'));
  const valid = parsed === null || (Number.isFinite(parsed) && parsed >= 0);
  const changed = parsed !== branch.minimumStock;
  const isLow = branch.stock < branch.effectiveMinimum;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {branch.branchName}
        </Typography>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Typography
            variant="body2"
            color={isLow ? 'error.main' : 'text.primary'}
            sx={{ fontWeight: 700 }}
          >
            {branch.stock} {item.unit}
          </Typography>
          {isLow && <StatusChip label="Bajo" tone="warning" />}
        </Stack>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          size="small"
          label="Mínimo en esta sede"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))}
          placeholder={String(item.minimumStock)}
          error={!valid}
          helperText={
            value.trim() === ''
              ? `Vacío: el general (${item.minimumStock} ${item.unit})`
              : undefined
          }
          disabled={!editable}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          sx={{ flex: 1 }}
        />
        {editable && changed && valid && (
          <Button
            size="small"
            variant="contained"
            sx={{ height: 40 }}
            loading={setMinimum.isPending}
            onClick={() =>
              setMinimum.mutate(
                { itemId: item.id, branchId: branch.branchId, minimumStock: parsed },
                {
                  onSuccess: () =>
                    enqueueSnackbar(`${branch.branchName}: mínimo actualizado`, {
                      variant: 'success',
                    }),
                  onError: (error) =>
                    enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
                },
              )
            }
          >
            Guardar
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

/** Each branch's stock of the item and the minimum it is held to (its own, or the general one). */
export default function InventoryBranchesSection({ item }: { item: InventoryItem }) {
  const { data: branches } = useItemBranches(item.id);
  const { hasPermission } = usePermissions();
  const ownBranch = useAuthStore((s) => s.user?.branchId ?? null);

  // One branch: the general minimum is its minimum.
  if (!branches || branches.length < 2) return null;
  const canManage = hasPermission('inventory.manage');
  const canSwitch = hasPermission('branches.switch');

  return (
    <>
      <Divider />
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Por sede
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Cada sede tiene su propio stock. Puedes darle a cada una su propio mínimo; si lo dejas
          vacío usa el general.
        </Typography>
        <Stack spacing={1}>
          {branches.map((branch) => (
            <BranchRow
              key={`${branch.branchId}-${branch.minimumStock}`}
              item={item}
              branch={branch}
              editable={
                canManage && (canSwitch || ownBranch === null || ownBranch === branch.branchId)
              }
            />
          ))}
        </Stack>
      </Box>
    </>
  );
}
