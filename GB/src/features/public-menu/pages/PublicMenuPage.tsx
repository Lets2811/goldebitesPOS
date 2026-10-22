import { useParams, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import PublicMenuBrowser from '../components/PublicMenuBrowser';

/**
 * The menu's public link — no branch/table context, doesn't start a visit, and
 * browse-only: nothing can be ordered from it. See NfcTableMenuPage for the
 * gallo-scoped experience.
 */
export default function PublicMenuPage() {
  const { businessId } = useParams<{ businessId: string }>();
  // ?sede=: the menu of that branch (what it offers, at its prices).
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get('sede') ?? undefined;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: { xs: 3, sm: 6 }, px: 2 }}>
      <PublicMenuBrowser businessId={businessId} branchId={branchId} readOnly />
    </Box>
  );
}
