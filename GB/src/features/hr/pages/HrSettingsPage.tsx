import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useSnackbar } from 'notistack';
import PageHeader from '../../../components/common/PageHeader';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useBranches } from '../../../modules/branches/hooks/use-branches';
import { useBranchRules } from '../../../modules/hr/hooks/use-branch-rules';
import { useSetBranchRules } from '../../../modules/hr/hooks/use-set-branch-rules';

interface RuleRow {
  title: string;
  description: string;
}

const emptyRow: RuleRow = { title: '', description: '' };

export default function HrSettingsPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { data: branches, isLoading: branchesLoading } = useBranches({ isActive: true });
  const [branchId, setBranchId] = useState('');

  if (!branchId && branches?.data && branches.data.length > 0) {
    setBranchId(branches.data[0].id);
  }

  const { data: rules, isLoading: rulesLoading } = useBranchRules(branchId);
  const setBranchRules = useSetBranchRules();

  const [rows, setRows] = useState<RuleRow[]>([emptyRow]);
  const [rowsBranchKey, setRowsBranchKey] = useState<string | null>(null);

  if (branchId && rules && rowsBranchKey !== branchId) {
    setRowsBranchKey(branchId);
    setRows(rules.length > 0 ? rules.map((r) => ({ title: r.title, description: r.description ?? '' })) : [emptyRow]);
  }

  const updateRow = (index: number, patch: Partial<RuleRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow]);

  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

  const validRows = rows
    .map((row) => ({ title: row.title.trim(), description: row.description.trim() }))
    .filter((row) => row.title.length > 0);

  function handleSave() {
    if (!branchId) return;
    setBranchRules.mutate(
      {
        branchId,
        rules: validRows.map((row) => ({
          title: row.title,
          description: row.description || undefined,
        })),
      },
      {
        onSuccess: () => enqueueSnackbar('Normas guardadas', { variant: 'success' }),
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );
  }

  return (
    <>
      <PageHeader
        title="Recursos Humanos"
        subtitle="Normas por sede y descripciones de rol, visibles para cada empleado en su perfil."
        breadcrumbs={[{ label: 'Recursos Humanos' }]}
      />

      <Stack spacing={3}>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {(branches?.data ?? []).length > 1 ? 'Normas por sede' : 'Normas del negocio'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {(branches?.data ?? []).length > 1
                    ? 'Cada empleado ve estas normas en "Mi Perfil", según la sede a la que esté asignado.'
                    : 'Cada empleado ve estas normas en "Mi Perfil".'}
                </Typography>
              </Box>

              {branchesLoading ? (
                <LoadingSkeleton variant="list" />
              ) : (branches?.data ?? []).length <= 1 ? null : (
                <TextField
                  select
                  label="Sede"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  sx={{ maxWidth: 320 }}
                >
                  {(branches?.data ?? []).map((branch) => (
                    <MenuItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              {branchId && (
                <>
                  {rulesLoading ? (
                    <LoadingSkeleton variant="list" />
                  ) : (
                    <Stack spacing={1.5}>
                      {rows.map((row, index) => (
                        <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                          <TextField
                            size="small"
                            label="Título"
                            placeholder={`Norma ${index + 1}`}
                            value={row.title}
                            onChange={(e) => updateRow(index, { title: e.target.value })}
                            sx={{ width: 220 }}
                          />
                          <TextField
                            size="small"
                            label="Descripción (opcional)"
                            value={row.description}
                            onChange={(e) => updateRow(index, { description: e.target.value })}
                            fullWidth
                            multiline
                          />
                          <IconButton
                            size="small"
                            aria-label="Eliminar norma"
                            onClick={() => removeRow(index)}
                            disabled={rows.length === 1}
                            sx={{ mt: 0.5 }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </Stack>
                      ))}
                      <Button size="small" startIcon={<Plus size={16} />} onClick={addRow} sx={{ alignSelf: 'flex-start' }}>
                        Agregar norma
                      </Button>
                    </Stack>
                  )}

                  <Box>
                    <Button variant="contained" loading={setBranchRules.isPending} onClick={handleSave}>
                      Guardar normas
                    </Button>
                  </Box>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Descripciones de rol
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  La descripción de cada rol se edita en Roles y permisos — cada empleado la ve en su perfil.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                endIcon={<ArrowRight size={16} />}
                onClick={() => navigate('/roles-permisos')}
              >
                Ir a Roles y permisos
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </>
  );
}
