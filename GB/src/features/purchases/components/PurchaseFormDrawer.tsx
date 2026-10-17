import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { FileText, ImageIcon, Paperclip, X } from 'lucide-react';
import CurrencyField from '../../../components/common/CurrencyField';
import FormDrawer from '../../../components/common/FormDrawer';
import {
  ACCEPTED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  formatFileSize,
} from '../../../modules/finances/api/expense-attachments.api';
import { SUPPLIER_PAYMENT_SOURCE_LABELS } from '../../../modules/finances/expense-payment-source';
import { useExpenseCategories } from '../../../modules/finances/hooks/use-expense-categories';
import type { CreateExpensePayload, SupplierPaymentSource } from '../../../modules/finances/types/expense.types';
import { useSuppliers } from '../../../modules/suppliers/hooks/use-suppliers';
import { formatCOP } from '../../../utils/format';

type PaymentMode = 'CASH_PAID' | 'CREDIT' | 'PARTIAL';

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'CASH_PAID', label: 'De contado' },
  { value: 'CREDIT', label: 'A crédito' },
  { value: 'PARTIAL', label: 'Pago parcial' },
];
const SOURCES = Object.keys(SUPPLIER_PAYMENT_SOURCE_LABELS) as SupplierPaymentSource[];

/** Lo elegido en el campo de proveedor: uno existente, o un nombre nuevo escrito a mano. */
type SupplierChoice = { id: string; name: string } | { newName: string } | null;

const purchaseSchema = z
  .object({
    name: z.string().trim().min(2, 'Escribe qué se compró').max(150),
    amount: z.coerce.number().positive('La cantidad debe ser mayor que cero'),
    purchaseDate: z.string().min(1, 'Elige la fecha de compra'),
    responsible: z.string().trim().min(2, 'Indica quién hizo la compra').max(150),
    category: z.string().min(1, 'Elige el tipo de gasto'),
    paymentMode: z.enum(['CASH_PAID', 'CREDIT', 'PARTIAL']),
    source: z.string(),
    initialAmount: z.coerce.number().min(0),
    dueDate: z.string(),
    notes: z.string().max(255),
  })
  .superRefine((values, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (values.paymentMode !== 'CREDIT' && !SOURCES.includes(values.source as SupplierPaymentSource)) {
      issue('source', 'Elige de dónde salió el dinero');
    }
    if (values.paymentMode === 'PARTIAL') {
      if (!(values.initialAmount > 0)) issue('initialAmount', 'Indica cuánto se pagó ahora');
      else if (values.initialAmount >= values.amount) issue('initialAmount', 'Si se pagó todo, elige "De contado"');
    }
  });

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

interface PurchaseFormDrawerProps {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  /** La compra para el backend, y los comprobantes que se suben una vez creada. */
  onSubmit: (payload: CreateExpensePayload, files: File[]) => void;
}

const fileError = (file: File) => {
  if (!ACCEPTED_ATTACHMENT_TYPES.split(',').includes(file.type)) return 'Solo PDF o imágenes';
  if (file.size > MAX_ATTACHMENT_BYTES) return 'Pesa más de 10 MB';
  return null;
};

/**
 * Registrar una compra: qué, cuánto, cuándo, quién, a qué proveedor y cómo se
 * pagó. Pagada de contado sale toda de una fuente; a crédito o en parte, queda
 * lo pendiente en Cuentas por pagar. Se le pueden adjuntar los comprobantes.
 */
export default function PurchaseFormDrawer({ open, loading, onClose, onSubmit }: PurchaseFormDrawerProps) {
  const { active: categories } = useExpenseCategories();
  const { data: supplierPage } = useSuppliers({ isActive: true, limit: 100 });
  const suppliers = useMemo(() => supplierPage?.data ?? [], [supplierPage]);
  const [supplier, setSupplier] = useState<SupplierChoice>(null);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dueDateTouched = useRef(false);
  const [wasOpen, setWasOpen] = useState(open);

  // Lo que vive fuera del formulario también arranca vacío cada vez que se abre.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSupplier(null);
      setSupplierError(null);
      setFiles([]);
      setFileProblem(null);
    }
  }

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PurchaseFormValues>({ resolver: zodResolver(purchaseSchema) });

  const defaultCategory = categories.find((c) => c.isCostOfSales)?.code ?? categories[0]?.code ?? '';

  useEffect(() => {
    if (!open) return;
    dueDateTouched.current = false;
    reset({
      name: '',
      amount: 0,
      purchaseDate: dayjs().format('YYYY-MM-DD'),
      responsible: '',
      category: defaultCategory,
      paymentMode: 'CASH_PAID',
      source: '',
      initialAmount: 0,
      dueDate: '',
      notes: '',
    });
  }, [open, reset, defaultCategory]);

  const paymentMode = useWatch({ control, name: 'paymentMode' });
  const purchaseDate = useWatch({ control, name: 'purchaseDate' });
  const amount = useWatch({ control, name: 'amount' });
  const initialAmount = useWatch({ control, name: 'initialAmount' });
  const onCredit = paymentMode !== 'CASH_PAID';
  const creditDays = supplier && 'id' in supplier ? suppliers.find((s) => s.id === supplier.id)?.creditDays : null;

  // Mientras no se toque a mano, el vencimiento sigue a la fecha y a los días de crédito del proveedor.
  useEffect(() => {
    if (!onCredit || dueDateTouched.current) return;
    setValue('dueDate', creditDays != null && purchaseDate ? dayjs(purchaseDate).add(creditDays, 'day').format('YYYY-MM-DD') : '');
  }, [onCredit, creditDays, purchaseDate, setValue]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const rejected = incoming.filter((file) => fileError(file));
    setFileProblem(rejected.length > 0 ? `${rejected.map((f) => f.name).join(', ')}: ${fileError(rejected[0])}` : null);
    setFiles((current) => [...current, ...incoming.filter((file) => !fileError(file))]);
  };

  const submit = handleSubmit((values) => {
    if (onCredit && !supplier) {
      setSupplierError('Elige o escribe el proveedor: queda debiéndosele');
      return;
    }
    const supplierFields =
      supplier && 'id' in supplier ? { supplierId: supplier.id } : supplier ? { newSupplierName: supplier.newName } : {};
    const base = {
      category: values.category,
      name: values.name.trim(),
      description: values.notes.trim() || values.name.trim(),
      responsible: values.responsible.trim(),
      amount: values.amount,
      expenseDate: values.purchaseDate,
      ...supplierFields,
    };
    const payload: CreateExpensePayload =
      values.paymentMode === 'CASH_PAID'
        ? { ...base, paymentSource: values.source as SupplierPaymentSource }
        : {
            ...base,
            paymentSource: 'SUPPLIER_CREDIT',
            dueDate: values.dueDate || undefined,
            initialPayment:
              values.paymentMode === 'PARTIAL'
                ? { amount: values.initialAmount, source: values.source as SupplierPaymentSource, paymentDate: values.purchaseDate }
                : undefined,
          };
    onSubmit(payload, files);
  });

  const pendingAfter = Math.max(0, (Number(amount) || 0) - (paymentMode === 'PARTIAL' ? Number(initialAmount) || 0 : 0));

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title="Registrar compra"
      submitLabel="Registrar compra"
      loading={loading}
      width={480}
    >
      <Stack spacing={2.5}>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              value={field.value ?? ''}
              label="Compra"
              placeholder="Ej. pollo para la semana"
              fullWidth
              error={Boolean(errors.name)}
              helperText={errors.name?.message}
            />
          )}
        />

        <Autocomplete<{ id: string; name: string }, false, false, true>
          freeSolo
          options={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
          value={supplier && 'id' in supplier ? supplier : supplier ? supplier.newName : null}
          onChange={(_, value) => {
            setSupplierError(null);
            if (!value) setSupplier(null);
            else if (typeof value === 'string') setSupplier(value.trim() ? { newName: value.trim() } : null);
            else setSupplier(value);
          }}
          onInputChange={(_, value, reason) => {
            // Escribir sin elegir de la lista también cuenta: es un proveedor nuevo.
            if (reason !== 'input') return;
            setSupplierError(null);
            const match = suppliers.find((s) => s.name.toLowerCase() === value.trim().toLowerCase());
            setSupplier(match ? { id: match.id, name: match.name } : value.trim() ? { newName: value.trim() } : null);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={onCredit ? 'Proveedor' : 'Proveedor (opcional)'}
              error={Boolean(supplierError)}
              helperText={
                supplierError ??
                (supplier && 'newName' in supplier
                  ? `"${supplier.newName}" no está en la lista: se agrega como proveedor nuevo.`
                  : creditDays != null
                    ? `Da ${creditDays} días de crédito.`
                    : 'Elige uno de la lista o escribe uno nuevo.')
              }
            />
          )}
        />

        <Stack direction="row" spacing={2}>
          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <CurrencyField
                {...field}
                value={field.value ?? ''}
                label="Valor de la compra"
                fullWidth
                error={Boolean(errors.amount)}
                helperText={errors.amount?.message}
              />
            )}
          />
          <Controller
            name="purchaseDate"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                label="Fecha de compra"
                type="date"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                error={Boolean(errors.purchaseDate)}
                helperText={errors.purchaseDate?.message}
              />
            )}
          />
        </Stack>

        <Stack direction="row" spacing={2}>
          <Controller
            name="responsible"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                label="Responsable"
                fullWidth
                error={Boolean(errors.responsible)}
                helperText={errors.responsible?.message}
              />
            )}
          />
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                select
                label="Tipo de gasto"
                fullWidth
                error={Boolean(errors.category)}
                helperText={errors.category?.message}
              >
                {categories.map((category) => (
                  <MenuItem key={category.code} value={category.code}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Stack>

        <Controller
          name="paymentMode"
          control={control}
          render={({ field }) => (
            <FormControl>
              <FormLabel sx={{ mb: 1, fontSize: '0.85rem' }}>Forma de pago</FormLabel>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={field.value ?? 'CASH_PAID'}
                onChange={(_, value: PaymentMode | null) => value && field.onChange(value)}
                aria-label="Forma de pago"
              >
                {PAYMENT_MODES.map((mode) => (
                  <ToggleButton key={mode.value} value={mode.value}>
                    {mode.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </FormControl>
          )}
        />

        {paymentMode === 'PARTIAL' && (
          <Controller
            name="initialAmount"
            control={control}
            render={({ field }) => (
              <CurrencyField
                {...field}
                value={field.value ?? ''}
                label="Pagado ahora"
                fullWidth
                error={Boolean(errors.initialAmount)}
                helperText={errors.initialAmount?.message}
              />
            )}
          />
        )}

        {paymentMode !== 'CREDIT' && (
          <Controller
            name="source"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                select
                label="¿De dónde salió el dinero?"
                fullWidth
                error={Boolean(errors.source)}
                helperText={errors.source?.message}
              >
                {SOURCES.map((source) => (
                  <MenuItem key={source} value={source}>
                    {SUPPLIER_PAYMENT_SOURCE_LABELS[source]}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        )}

        {onCredit && (
          <>
            <Controller
              name="dueDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Vence el (opcional)"
                  type="date"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  onChange={(e) => {
                    dueDateTouched.current = true;
                    field.onChange(e);
                  }}
                />
              )}
            />
            <Alert severity="info" variant="outlined">
              Queda debiéndose {formatCOP(pendingAfter)}: se paga después, en una o varias cuotas, desde Cuentas por
              pagar. El gasto cuenta a medida que se paga.
            </Alert>
          </>
        )}

        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <TextField {...field} value={field.value ?? ''} label="Notas (opcional)" multiline minRows={2} fullWidth />
          )}
        />

        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Comprobantes
          </Typography>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_ATTACHMENT_TYPES}
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Stack spacing={1}>
            {files.map((file, index) => (
              <Stack
                key={`${file.name}-${index}`}
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', px: 1.25, py: 0.75, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
              >
                {file.type === 'application/pdf' ? <FileText size={16} /> : <ImageIcon size={16} />}
                <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                  {file.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(file.size)}
                </Typography>
                <IconButton
                  size="small"
                  aria-label={`Quitar ${file.name}`}
                  onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                >
                  <X size={14} />
                </IconButton>
              </Stack>
            ))}
            <Button
              variant="outlined"
              size="small"
              startIcon={<Paperclip size={15} />}
              onClick={() => fileInput.current?.click()}
              sx={{ alignSelf: 'flex-start' }}
            >
              Adjuntar factura o comprobante
            </Button>
            <Typography variant="caption" color={fileProblem ? 'error' : 'text.secondary'}>
              {fileProblem ?? 'PDF o imágenes (JPG, PNG, WEBP), hasta 10 MB cada uno.'}
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </FormDrawer>
  );
}
