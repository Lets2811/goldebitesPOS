import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import CurrencyField from '../../../components/common/CurrencyField';
import StatusChip from '../../../components/common/StatusChip';
import { normalizeApiError } from '../../../lib/api/api-error';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import {
  useProductBranches,
  useSetProductBranch,
  type ProductAtBranch,
} from '../../../modules/products/branch-menu';
import type { Product } from '../../../modules/products/types/product.types';
import { formatCOP } from '../../../utils/format';

function BranchRow({
  product,
  branch,
  editable,
}: {
  product: Product;
  branch: ProductAtBranch;
  editable: boolean;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const setProductBranch = useSetProductBranch();
  const [price, setPrice] = useState<number | ''>(branch.salePrice ?? '');
  const priceChanged = (price === '' ? null : price) !== branch.salePrice;

  const save = (isAvailable: boolean, salePrice: number | null) =>
    setProductBranch.mutate(
      { productId: product.id, branchId: branch.branchId, isAvailable, salePrice },
      {
        onSuccess: () =>
          enqueueSnackbar(`${branch.branchName}: actualizado`, { variant: 'success' }),
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {branch.branchName}
        </Typography>
        {branch.isAvailable && branch.outOfStock && <StatusChip label="Agotado" tone="error" />}
      </Stack>
      <FormControlLabel
        disabled={!editable || setProductBranch.isPending}
        control={
          <Switch
            size="small"
            checked={branch.isAvailable}
            onChange={(e) => save(e.target.checked, branch.salePrice)}
          />
        }
        label={<Typography variant="body2">Se vende en esta sede</Typography>}
      />
      {branch.isAvailable && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.5 }}>
          <CurrencyField
            size="small"
            label="Precio en esta sede"
            value={price}
            onChange={setPrice}
            placeholder={formatCOP(product.salePrice)}
            helperText={
              price === '' ? `Vacío: el del catálogo (${formatCOP(product.salePrice)})` : undefined
            }
            disabled={!editable}
            sx={{ flex: 1 }}
          />
          {priceChanged && editable && (
            <Button
              size="small"
              variant="contained"
              loading={setProductBranch.isPending}
              onClick={() => save(true, price === '' ? null : price)}
            >
              Guardar
            </Button>
          )}
        </Stack>
      )}
    </Paper>
  );
}

/**
 * Where the product sells: each branch can leave it out or set its own price,
 * and a product whose recipe a branch has no stock for is sold out there
 * (hidden from its menus until stock comes in).
 */
export default function ProductBranchesSection({ product }: { product: Product }) {
  const { data: branches } = useProductBranches(product.id);
  const { hasPermission } = usePermissions();
  const ownBranch = useAuthStore((s) => s.user?.branchId ?? null);

  if (!branches || branches.length === 0) return null;
  const canUpdate = hasPermission('products.update');
  const canSwitch = hasPermission('branches.switch');

  // A single branch: nothing to choose between, only whether it ran out.
  if (branches.length === 1) {
    const [only] = branches;
    return only.outOfStock ? (
      <>
        <Divider />
        <Alert severity="warning">
          Agotado: no hay insumos suficientes para prepararlo. No aparece en el menú hasta que entre
          stock.
        </Alert>
      </>
    ) : null;
  }

  return (
    <>
      <Divider />
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Por sede
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Cada sede puede no venderlo o venderlo a otro precio. Si a una sede le faltan insumos de
          la receta, sale como agotado y no se muestra en su menú.
        </Typography>
        <Stack spacing={1}>
          {branches.map((branch) => (
            <BranchRow
              key={`${branch.branchId}-${branch.salePrice}`}
              product={product}
              branch={branch}
              editable={
                canUpdate && (canSwitch || ownBranch === null || ownBranch === branch.branchId)
              }
            />
          ))}
        </Stack>
      </Box>
    </>
  );
}
