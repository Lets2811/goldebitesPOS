import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { normalizeApiError } from '../../../lib/api/api-error';
import { customersApi } from '../../../modules/customers/api/customers.api';
import { useIssueEInvoice } from '../../../modules/e-invoicing/hooks/use-e-invoicing';
import {
  BUYER_DOCUMENTS,
  type EInvoiceBuyer,
  type ElectronicInvoice,
} from '../../../modules/e-invoicing/types/e-invoicing.types';
import type { OrderWithItems } from '../../../modules/orders/types/order.types';
import { formatCOP } from '../../../utils/format';

interface EInvoiceDialogProps {
  open: boolean;
  order: OrderWithItems;
  sandbox: boolean;
  onClose: () => void;
  onIssued: (invoice: ElectronicInvoice) => void;
}

interface BuyerForm {
  documentCode: string;
  identification: string;
  legalOrganization: 'NATURAL' | 'JURIDICA';
  name: string;
  email: string;
  phone: string;
  address: string;
}

const EMPTY: BuyerForm = { documentCode: '13', identification: '', legalOrganization: 'NATURAL', name: '', email: '', phone: '', address: '' };

/**
 * Factura electrónica de un pedido pagado: a consumidor final (lo normal en
 * un restaurante) o a un comprador identificado, que la recibe por correo.
 */
export default function EInvoiceDialog({ open, order, sandbox, onClose, onIssued }: EInvoiceDialogProps) {
  const issue = useIssueEInvoice();
  const [kind, setKind] = useState<'FINAL_CONSUMER' | 'IDENTIFIED'>('FINAL_CONSUMER');
  const [form, setForm] = useState<BuyerForm>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  // The order's customer, to prefill the buyer.
  const { data: customer } = useQuery({
    queryKey: ['customers', 'detail', order.customerId],
    queryFn: () => customersApi.getCustomer(order.customerId!),
    enabled: open && Boolean(order.customerId),
  });
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setKind('FINAL_CONSUMER');
      setForm(EMPTY);
      setError(null);
      setPrefilledFor(null);
    }
  }
  if (open && customer && prefilledFor !== customer.id) {
    setPrefilledFor(customer.id);
    setForm({
      ...EMPTY,
      identification: customer.documentNumber ?? '',
      name: [customer.firstName, customer.lastName].filter(Boolean).join(' '),
      email: customer.email ?? '',
      phone: customer.phone ?? '',
    });
    if (customer.documentNumber) setKind('IDENTIFIED');
  }

  const set = <K extends keyof BuyerForm>(key: K, value: BuyerForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const identifiedValid = form.identification.trim().length >= 3 && form.name.trim().length > 0;
  const canSubmit = !issue.isPending && (kind === 'FINAL_CONSUMER' || identifiedValid);

  const submit = () => {
    setError(null);
    const buyer: EInvoiceBuyer =
      kind === 'FINAL_CONSUMER'
        ? { kind }
        : {
            kind,
            documentCode: form.documentCode,
            identification: form.identification.trim(),
            legalOrganization: form.legalOrganization,
            name: form.name.trim(),
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
            address: form.address.trim() || undefined,
          };
    issue.mutate(
      { orderId: order.id, buyer },
      {
        onSuccess: onIssued,
        onError: (e) => setError(normalizeApiError(e).message),
      },
    );
  };

  return (
    <Dialog open={open} onClose={issue.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Factura electrónica · Pedido #{order.orderNumber}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {sandbox && (
            <Alert severity="warning">Ambiente de pruebas: la factura se valida con la DIAN de pruebas y no tiene validez fiscal.</Alert>
          )}
          <Typography variant="body2" color="text.secondary">
            Total a facturar: <b>{formatCOP(order.totalAmount)}</b>. Se envía a la DIAN y queda con su número, CUFE y código QR.
          </Typography>
          <ToggleButtonGroup exclusive fullWidth value={kind} onChange={(_e, value) => value && setKind(value)} size="small">
            <ToggleButton value="FINAL_CONSUMER">Consumidor final</ToggleButton>
            <ToggleButton value="IDENTIFIED">Con datos del comprador</ToggleButton>
          </ToggleButtonGroup>

          {kind === 'IDENTIFIED' && (
            <Stack spacing={2}>
              <ToggleButtonGroup
                exclusive
                value={form.legalOrganization}
                onChange={(_e, value) => {
                  if (!value) return;
                  set('legalOrganization', value);
                  if (value === 'JURIDICA') set('documentCode', '31');
                }}
                size="small"
              >
                <ToggleButton value="NATURAL">Persona</ToggleButton>
                <ToggleButton value="JURIDICA">Empresa</ToggleButton>
              </ToggleButtonGroup>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField select label="Documento" value={form.documentCode} onChange={(e) => set('documentCode', e.target.value)} sx={{ minWidth: 220 }}>
                  {BUYER_DOCUMENTS.map((doc) => (
                    <MenuItem key={doc.code} value={doc.code}>
                      {doc.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label={form.documentCode === '31' ? 'NIT (sin dígito de verificación)' : 'Número'}
                  value={form.identification}
                  onChange={(e) => set('identification', e.target.value)}
                  fullWidth
                  required
                />
              </Stack>
              <TextField
                label={form.legalOrganization === 'JURIDICA' ? 'Razón social' : 'Nombre completo'}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="Correo (recibe la factura)" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} fullWidth />
                <TextField label="Teléfono" value={form.phone} onChange={(e) => set('phone', e.target.value)} fullWidth />
              </Stack>
              <TextField label="Dirección" value={form.address} onChange={(e) => set('address', e.target.value)} />
            </Stack>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={issue.isPending}>
          Cancelar
        </Button>
        <Button variant="contained" disabled={!canSubmit} onClick={submit}>
          {issue.isPending ? 'Enviando a la DIAN…' : 'Emitir factura electrónica'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
