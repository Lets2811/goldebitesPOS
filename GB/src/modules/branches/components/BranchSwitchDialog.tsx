import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import { useAuthStore } from '../../auth/store/auth.store';
import BranchChooser from './BranchChooser';

/**
 * "Cambiar de sede" from the menu. The page reloads at the start once the
 * session moved: every screen then loads the new branch's data from scratch.
 */
export default function BranchSwitchDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const current = useAuthStore((s) => s.user?.branchId ?? null);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 0.5 }}>Cambiar de sede</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Toda la información pasa a ser la de la sede que elijas.
        </Typography>
        <BranchChooser
          current={current}
          onSwitched={() => {
            onClose();
            window.location.assign('/');
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
