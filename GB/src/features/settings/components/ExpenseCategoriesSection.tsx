import { useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useSnackbar } from 'notistack';
import StatusChip from '../../../components/common/StatusChip';
import { normalizeApiError } from '../../../lib/api/api-error';
import {
  useCreateExpenseCategory,
  useDeleteExpenseCategory,
  useExpenseCategories,
  useUpdateExpenseCategory,
} from '../../../modules/finances/hooks/use-expense-categories';
import type { ExpenseCategoryDefinition } from '../../../modules/finances/types/expense.types';

/** Los rechazos del backend al administrar tipos de gasto llegan en inglés. */
const ERROR_MESSAGES: Record<string, string> = {
  EXPENSE_CATEGORY_NAME_TAKEN: 'Ya existe un tipo de gasto con ese nombre.',
  EXPENSE_CATEGORY_IN_USE:
    'Ese tipo tiene gastos registrados y no se puede eliminar. Desactívalo para que no se use en gastos nuevos.',
  LAST_ACTIVE_EXPENSE_CATEGORY: 'Debe quedar al menos un tipo de gasto activo.',
};

function errorMessage(error: unknown): string {
  const normalized = normalizeApiError(error);
  return (normalized.code && ERROR_MESSAGES[normalized.code]) || normalized.message;
}

function CategoryRow({ category }: { category: ExpenseCategoryDefinition }) {
  const { enqueueSnackbar } = useSnackbar();
  const updateCategory = useUpdateExpenseCategory();
  const deleteCategory = useDeleteExpenseCategory();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const busy = updateCategory.isPending || deleteCategory.isPending;

  const onError = (error: unknown) => enqueueSnackbar(errorMessage(error), { variant: 'error' });

  function saveName() {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed === category.name) {
      setEditing(false);
      return;
    }
    updateCategory.mutate(
      { id: category.id, payload: { name: trimmed } },
      { onSuccess: () => setEditing(false), onError },
    );
  }

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', py: 0.75 }}
    >
      {editing ? (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flex: 1 }}>
          <TextField
            size="small"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName();
              if (e.key === 'Escape') setEditing(false);
            }}
            disabled={busy}
            sx={{ maxWidth: 280, flex: 1 }}
          />
          <IconButton size="small" onClick={saveName} disabled={busy} aria-label="Guardar nombre">
            <Check size={16} />
          </IconButton>
          <IconButton size="small" onClick={() => setEditing(false)} disabled={busy} aria-label="Cancelar">
            <X size={16} />
          </IconButton>
        </Stack>
      ) : (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {category.name}
          </Typography>
          <IconButton
            size="small"
            aria-label={`Renombrar ${category.name}`}
            onClick={() => {
              setName(category.name);
              setEditing(true);
            }}
          >
            <Pencil size={14} />
          </IconButton>
          {!category.isActive && <StatusChip label="Inactivo" tone="neutral" />}
        </Stack>
      )}

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Tooltip title="Márcalo en los tipos que son el costo de lo que vendes (insumos, mercancía). Finanzas los resta de las ventas para calcular el margen bruto.">
          <FormControlLabel
            sx={{ mr: 0 }}
            control={
              <Checkbox
                size="small"
                checked={category.isCostOfSales}
                disabled={busy}
                onChange={(_, isCostOfSales) =>
                  updateCategory.mutate({ id: category.id, payload: { isCostOfSales } }, { onError })
                }
              />
            }
            label={<Typography variant="caption">Costo de ventas</Typography>}
          />
        </Tooltip>
        <Tooltip title={category.isActive ? 'Disponible para gastos nuevos' : 'No aparece al registrar gastos'}>
          <Switch
            size="small"
            checked={category.isActive}
            disabled={busy}
            onChange={(_, isActive) =>
              updateCategory.mutate({ id: category.id, payload: { isActive } }, { onError })
            }
            slotProps={{ input: { 'aria-label': `Activar ${category.name}` } }}
          />
        </Tooltip>
        <Tooltip title="Eliminar (solo si no tiene gastos registrados)">
          <span>
            <IconButton
              size="small"
              disabled={busy}
              aria-label={`Eliminar ${category.name}`}
              onClick={() =>
                deleteCategory.mutate(category.id, {
                  onSuccess: () => enqueueSnackbar('Tipo de gasto eliminado', { variant: 'success' }),
                  onError,
                })
              }
            >
              <Trash2 size={15} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Stack>
  );
}

/** La lista de tipos de gasto del negocio: se usa al registrar gastos y en Finanzas. */
export default function ExpenseCategoriesSection() {
  const { enqueueSnackbar } = useSnackbar();
  const { categories, isLoading } = useExpenseCategories();
  const createCategory = useCreateExpenseCategory();
  const [newName, setNewName] = useState('');

  function handleCreate() {
    const name = newName.trim();
    if (name.length < 2) return;
    createCategory.mutate(
      { name },
      {
        onSuccess: () => {
          setNewName('');
          enqueueSnackbar('Tipo de gasto agregado', { variant: 'success' });
        },
        onError: (error) => enqueueSnackbar(errorMessage(error), { variant: 'error' }),
      },
    );
  }

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ChevronDown size={18} />}>
        <Typography sx={{ fontWeight: 700 }}>Tipos de gasto</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Son las opciones que aparecen al registrar un gasto y los grupos con los que Finanzas resume en qué se va el
          dinero. Renombrar un tipo no cambia los gastos ya registrados.
        </Typography>

        <Stack divider={<span style={{ borderTop: '1px solid var(--mui-palette-divider, rgba(128,128,128,.2))' }} />}>
          {categories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
          {!isLoading && categories.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Aún no hay tipos de gasto.
            </Typography>
          )}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            label="Nuevo tipo de gasto"
            placeholder="Ej.: Arriendo"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            sx={{ maxWidth: 320, flex: 1 }}
          />
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            loading={createCategory.isPending}
            disabled={newName.trim().length < 2}
            onClick={handleCreate}
          >
            Agregar
          </Button>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
