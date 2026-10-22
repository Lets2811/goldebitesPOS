import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatusChip from '../../../components/common/StatusChip';
import { useBranchComparison } from '../../../modules/branch-comparison/branch-comparison';
import { MODULE_PATHS } from '../../../routes/navConfig';
import { brand } from '../../../theme/palette';
import { formatCOP } from '../../../utils/format';

function todayRange() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}

/** In "Todas las sedes": a card per branch with how its day is going. */
export default function BranchTodayStrip() {
  const navigate = useNavigate();
  const range = useMemo(() => todayRange(), []);
  const { data } = useBranchComparison(range);
  const branches = (data?.branches ?? []).filter((branch) => branch.isActive);

  if (branches.length < 2) return null;
  const leader = branches.reduce(
    (best, b) => (b.salesTotal > best.salesTotal ? b : best),
    branches[0],
  );

  return (
    <Box sx={{ mb: 3 }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Hoy por sede
        </Typography>
        <Button
          size="small"
          endIcon={<ArrowRight size={15} />}
          onClick={() => navigate(MODULE_PATHS.branchComparison)}
        >
          Ver comparativo
        </Button>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
        }}
      >
        {branches.map((branch) => {
          const isLeader = leader.salesTotal > 0 && branch.branchId === leader.branchId;
          return (
            <Paper
              key={branch.branchId}
              variant="outlined"
              sx={{
                p: 1.75,
                borderRadius: 2,
                borderColor: isLeader ? brand.gold : 'divider',
                backgroundColor: isLeader ? alpha(brand.gold, 0.06) : undefined,
              }}
            >
              <Stack
                direction="row"
                sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
              >
                <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
                  {branch.name}
                </Typography>
                <StatusChip
                  label={branch.cashOpen ? 'Caja abierta' : 'Caja cerrada'}
                  tone={branch.cashOpen ? 'success' : 'neutral'}
                />
              </Stack>
              <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.75 }}>
                {formatCOP(branch.salesTotal)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {branch.orderCount} {branch.orderCount === 1 ? 'pedido' : 'pedidos'} ·{' '}
                {branch.activeOrders} en curso
              </Typography>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}
