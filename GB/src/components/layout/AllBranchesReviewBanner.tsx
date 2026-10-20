import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { Layers } from 'lucide-react';
import { useAllBranchesReview } from '../../modules/auth/hooks/use-branch-mode';
import BranchSwitchDialog from '../../modules/branches/components/BranchSwitchDialog';

/**
 * In "Todas las sedes": says it is for review, and offers to go to a branch
 * to record anything (orders, cash, stock moves...).
 */
export default function AllBranchesReviewBanner() {
  const reviewOnly = useAllBranchesReview();
  const [open, setOpen] = useState(false);
  if (!reviewOnly) return null;

  return (
    <>
      <Alert
        severity="info"
        icon={<Layers size={20} />}
        sx={{ mb: 2.5, alignItems: 'center' }}
        action={
          <Button color="inherit" size="small" onClick={() => setOpen(true)}>
            Elegir una sede
          </Button>
        }
      >
        Estás viendo <strong>todas las sedes</strong>: es un modo de revisión y gestión. Pedidos,
        cocina, caja y demás atención al público se trabajan desde una sede, y cada producto o
        insumo nuevo se crea en su sede.
      </Alert>
      <BranchSwitchDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
