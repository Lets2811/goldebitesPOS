import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import { usePermissionCatalog } from '../../../modules/permissions/hooks/use-permission-catalog';
import { getPermissionModuleLabel } from '../../../modules/roles/permission-module-labels';

interface PermissionChecklistProps {
  checked: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}

/** El catálogo de permisos agrupado por módulo, con una casilla por módulo para marcarlos todos a la vez. */
export default function PermissionChecklist({ checked, onChange }: PermissionChecklistProps) {
  const { data: catalog, isLoading } = usePermissionCatalog();

  const grouped = useMemo(() => {
    const map = new Map<string, { code: string; description: string }[]>();
    for (const perm of catalog ?? []) {
      const list = map.get(perm.module) ?? [];
      list.push({ code: perm.code, description: perm.description });
      map.set(perm.module, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  if (isLoading) return <LoadingSkeleton variant="list" />;

  const toggle = (code: string) => {
    const next = new Set(checked);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(next);
  };

  const toggleModule = (codes: string[], select: boolean) => {
    const next = new Set(checked);
    for (const code of codes) {
      if (select) next.add(code);
      else next.delete(code);
    }
    onChange(next);
  };

  return (
    <Stack spacing={2.5}>
      {grouped.map(([module, permissions], idx) => {
        const codes = permissions.map((perm) => perm.code);
        const selectedCount = codes.filter((code) => checked.has(code)).length;
        const allSelected = selectedCount === codes.length;

        return (
          <Box key={module}>
            {idx > 0 && <Divider sx={{ mb: 2 }} />}
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={allSelected}
                  indeterminate={selectedCount > 0 && !allSelected}
                  onChange={() => toggleModule(codes, !allSelected)}
                />
              }
              label={
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {getPermissionModuleLabel(module)}
                </Typography>
              }
            />
            <Stack spacing={0} sx={{ pl: 3.5 }}>
              {permissions.map((perm) => (
                <FormControlLabel
                  key={perm.code}
                  control={
                    <Checkbox size="small" checked={checked.has(perm.code)} onChange={() => toggle(perm.code)} />
                  }
                  label={
                    <Stack>
                      <Typography variant="body2">{perm.description}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {perm.code}
                      </Typography>
                    </Stack>
                  }
                />
              ))}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
