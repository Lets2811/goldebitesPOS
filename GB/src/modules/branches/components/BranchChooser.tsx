import Alert from '@mui/material/Alert';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { Check, Layers, Store } from 'lucide-react';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useSwitchBranch } from '../../auth/hooks/use-switch-branch';
import { brand } from '../../../theme/palette';
import { useBranches } from '../hooks/use-branches';

interface BranchChooserProps {
  /** The branch the session is at now: a branch id, null for all, undefined for none yet. */
  current?: string | null;
  /** After the session moved to the branch picked. */
  onSwitched?: () => void;
}

function Option({
  icon,
  title,
  detail,
  selected,
  loading,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  selected: boolean;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      sx={{
        width: '100%',
        justifyContent: 'flex-start',
        textAlign: 'left',
        gap: 1.5,
        p: 1.75,
        borderRadius: 2,
        border: 1,
        borderColor: selected ? brand.gold : 'divider',
        backgroundColor: selected ? alpha(brand.gold, 0.1) : 'transparent',
        transition: 'border-color 120ms, background-color 120ms',
        '&:hover': { borderColor: brand.gold, backgroundColor: alpha(brand.gold, 0.06) },
        '&.Mui-disabled': { opacity: 0.6 },
      }}
    >
      <Stack
        sx={{
          width: 40,
          height: 40,
          borderRadius: 1.5,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          color: brand.gold,
          backgroundColor: alpha(brand.gold, 0.12),
        }}
      >
        {icon}
      </Stack>
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {detail}
        </Typography>
      </Stack>
      {loading ? (
        <CircularProgress size={18} />
      ) : (
        selected && <Check size={18} color={brand.gold} />
      )}
    </ButtonBase>
  );
}

/** The business's active branches, and all of them together, to take the session to one. */
export default function BranchChooser({ current, onSwitched }: BranchChooserProps) {
  const { data, isLoading } = useBranches({ isActive: true, limit: 100 });
  const switchBranch = useSwitchBranch();
  const branches = data?.data ?? [];

  const choose = (branchId: string | null) => {
    if (branchId === current) {
      onSwitched?.();
      return;
    }
    switchBranch.mutate(branchId, { onSuccess: () => onSwitched?.() });
  };

  if (isLoading) {
    return (
      <Stack sx={{ alignItems: 'center', py: 4 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const pending = switchBranch.isPending ? switchBranch.variables : undefined;

  return (
    <Stack spacing={1.25}>
      {switchBranch.error && (
        <Alert severity="error">{normalizeApiError(switchBranch.error).message}</Alert>
      )}
      {branches.map((branch) => (
        <Option
          key={branch.id}
          icon={<Store size={20} />}
          title={branch.name}
          detail={[branch.address, branch.city].filter(Boolean).join(' · ') || 'Sede'}
          selected={current === branch.id}
          loading={pending === branch.id}
          disabled={switchBranch.isPending}
          onClick={() => choose(branch.id)}
        />
      ))}
      <Option
        icon={<Layers size={20} />}
        title="Todas las sedes"
        detail="Vista consolidada del negocio completo"
        selected={current === null}
        loading={pending === null}
        disabled={switchBranch.isPending}
        onClick={() => choose(null)}
      />
    </Stack>
  );
}
