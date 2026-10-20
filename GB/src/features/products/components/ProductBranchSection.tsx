import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Copy, Store } from 'lucide-react';
import { useSnackbar } from 'notistack';
import StatusChip from '../../../components/common/StatusChip';
import { normalizeApiError } from '../../../lib/api/api-error';
import { usePermissions } from '../../../modules/auth/hooks/use-permissions';
import { useBranches } from '../../../modules/branches/hooks/use-branches';
import { useBranchMenu, useCopyProductToBranch } from '../../../modules/products/branch-menu';
import type { Product } from '../../../modules/products/types/product.types';

/**
 * The branch the product belongs to (each branch has its own catalog), whether
 * it ran out there, and bringing it to another branch: an independent copy.
 */
export default function ProductBranchSection({ product }: { product: Product }) {
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = usePermissions();
  const { data: branchesData } = useBranches({ isActive: true, limit: 100 });
  const branches = branchesData?.data ?? [];
  const { data: menu } = useBranchMenu(product.branchId);
  const copy = useCopyProductToBranch();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');

  const branchName = branches.find((branch) => branch.id === product.branchId)?.name;
  const outOfStock = menu?.find((p) => p.id === product.id)?.outOfStock ?? false;
  const others = branches.filter((branch) => branch.id !== product.branchId);
  const canCopy = hasPermission('products.create') && others.length > 0;

  if (!outOfStock && branches.length < 2) return null;

  return (
    <>
      <Divider />
      <Box>
        {branches.length > 1 && (
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Store size={16} />
              <Typography variant="body2">
                Sede: <strong>{branchName ?? '—'}</strong>
              </Typography>
            </Stack>
            {canCopy && (
              <Button size="small" startIcon={<Copy size={15} />} onClick={() => setOpen(true)}>
                Llevar a otra sede
              </Button>
            )}
          </Stack>
        )}
        {outOfStock && product.isActive && (
          <Alert severity="warning" sx={{ mt: branches.length > 1 ? 1.5 : 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <StatusChip label="Agotado" tone="error" />
              <span>
                No hay insumos suficientes para prepararlo. No aparece en el menú hasta que entre
                stock.
              </span>
            </Stack>
          </Alert>
        )}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Llevar a otra sede</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Se crea una copia independiente de «{product.name}» en la sede que elijas, con su
            precio, opciones y receta. Allá se puede cambiar sin afectar este. Los insumos de la
            receta que esa sede no tenga se crean sin stock.
          </Typography>
          <TextField
            select
            fullWidth
            label="Sede"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            {others.map((branch) => (
              <MenuItem key={branch.id} value={branch.id}>
                {branch.name}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!target}
            loading={copy.isPending}
            onClick={() =>
              copy.mutate(
                { productId: product.id, branchId: target },
                {
                  onSuccess: () => {
                    enqueueSnackbar(
                      `«${product.name}» quedó también en ${others.find((b) => b.id === target)?.name ?? 'la otra sede'}`,
                      { variant: 'success' },
                    );
                    setOpen(false);
                    setTarget('');
                  },
                  onError: (error) =>
                    enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
                },
              )
            }
          >
            Llevar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
