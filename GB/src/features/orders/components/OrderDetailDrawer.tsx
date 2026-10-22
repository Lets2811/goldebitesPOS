import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import { useSnackbar } from 'notistack';
import IconButton from '@mui/material/IconButton';
import {
  MapPin,
  ArrowRight,
  Ban,
  CreditCard,
  Users,
  Printer,
  Receipt,
  Pencil,
  Plus,
  Check,
  X,
  FileCheck,
  FileText,
} from 'lucide-react';
import DetailDrawer from '../../../components/common/DetailDrawer';
import StatusChip from '../../../components/common/StatusChip';
import OptionSelectionsText from '../../../modules/option-groups/components/OptionSelectionsText';
import CurrencyDisplay from '../../../components/common/CurrencyDisplay';
import CurrencyField from '../../../components/common/CurrencyField';
import CashChangeCalculator from './CashChangeCalculator';
import DateDisplay from '../../../components/common/DateDisplay';
import { Can } from '../../../modules/auth/components/can';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useOrder } from '../../../modules/orders/hooks/use-order';
import { useOrderPayments } from '../../../modules/orders/hooks/use-order-payments';
import { useCreatePayment } from '../../../modules/orders/hooks/use-create-payment';
import { useUpdatePaymentMethod } from '../../../modules/orders/hooks/use-update-payment-method';
import { useReplaceOrderItems } from '../../../modules/orders/hooks/use-replace-order-items';
import { useAddOrderItems } from '../../../modules/orders/hooks/use-add-order-items';
import { usePrintKitchenTicket } from '../../../modules/orders/hooks/use-print-kitchen-ticket';
import { usePrintInvoice } from '../../../modules/orders/hooks/use-print-invoice';
import {
  openEInvoicePdf,
  useEInvoicingAvailable,
  useOrderEInvoice,
} from '../../../modules/e-invoicing/hooks/use-e-invoicing';
import EInvoiceDialog from './EInvoiceDialog';
import { normalizeApiError } from '../../../lib/api/api-error';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import SplitBillDialog from './SplitBillDialog';
import OrderDiscountSection from './OrderDiscountSection';
import EditOrderItemsDrawer from './EditOrderItemsDrawer';
import AddOrderItemsDrawer from './AddOrderItemsDrawer';
import {
  nextStatusFor,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONE,
  PAYMENT_METHOD_LABELS,
  getOrderIdentifierLabel,
} from '../../../modules/orders/order-status';
import { useTableNameMap } from '../../../modules/table-names/hooks/use-table-name-map';
import type { Order } from '../../../modules/orders/types/order.types';
import type { PaymentMethod } from '../../../modules/orders/types/payment.types';

interface OrderDetailDrawerProps {
  orderId: string | null;
  customerName: (order: Order) => string;
  onClose: () => void;
  onAdvance: (order: Order) => void;
  onCancel: (order: Order, reason: string) => void;
}

export default function OrderDetailDrawer({
  orderId,
  customerName,
  onClose,
  onAdvance,
  onCancel,
}: OrderDetailDrawerProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [splitBillOpen, setSplitBillOpen] = useState(false);
  const [editItemsOpen, setEditItemsOpen] = useState(false);
  const [addItemsOpen, setAddItemsOpen] = useState(false);
  const branchId = useAuthStore((s) => s.user?.branchId);
  const tableNames = useTableNameMap(branchId);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editMethod, setEditMethod] = useState<PaymentMethod>('CASH');
  const { enqueueSnackbar } = useSnackbar();

  const { data: order, isLoading } = useOrder(orderId);
  const { data: payments = [] } = useOrderPayments(orderId);
  const createPayment = useCreatePayment();
  const updatePaymentMethod = useUpdatePaymentMethod(orderId ?? '');
  const replaceItems = useReplaceOrderItems();
  const addItems = useAddOrderItems();
  const printTicket = usePrintKitchenTicket();
  const {
    printNow: printInvoiceNow,
    printByOrderId: printInvoiceByOrderId,
    printElectronic: printElectronicInvoice,
  } = usePrintInvoice();
  const { available: eInvoicing, sandbox: eInvoicingSandbox } = useEInvoicingAvailable();
  const { data: eInvoice } = useOrderEInvoice(orderId ?? undefined, eInvoicing);
  const [eInvoiceOpen, setEInvoiceOpen] = useState(false);

  if (!orderId) return null;

  if (isLoading || !order) {
    return (
      <DetailDrawer open={Boolean(orderId)} onClose={onClose} title="Cargando pedido...">
        <LoadingSkeleton variant="page" />
      </DetailDrawer>
    );
  }

  const next = nextStatusFor(order.status);
  const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = Math.max(order.totalAmount - amountPaid, 0);
  const canRegisterPayment = order.status !== 'CANCELLED' && balanceDue > 0;

  const handleRegisterPayment = () => {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) return;
    createPayment.mutate(
      { orderId: order.id, payload: { paymentMethod, amount } },
      {
        onSuccess: (payment) => {
          enqueueSnackbar('Pago registrado correctamente', { variant: 'success' });
          setPaymentAmount('');
          if (amountPaid + payment.amount >= order.totalAmount) {
            printInvoiceByOrderId(order.id).catch(() => {
              // Si falla la carga de datos para la factura, el usuario puede reimprimirla manualmente.
            });
          }
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );
  };

  const handleSavePaymentMethod = (paymentId: string) => {
    updatePaymentMethod.mutate(
      { paymentId, payload: { paymentMethod: editMethod } },
      {
        onSuccess: () => {
          enqueueSnackbar('Método de pago corregido', { variant: 'success' });
          setEditingPaymentId(null);
        },
        onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
      },
    );
  };

  return (
    <>
      <DetailDrawer
        open={Boolean(order)}
        onClose={onClose}
        title={`Pedido #${order.orderNumber}`}
        subtitle={ORDER_TYPE_LABELS[order.orderType]}
        headerExtra={
          <StatusChip
            label={ORDER_STATUS_LABELS[order.status]}
            tone={ORDER_STATUS_TONE[order.status]}
          />
        }
        footer={
          order.status !== 'DELIVERED' && order.status !== 'CANCELLED' ? (
            <Can permission="orders.update">
              <Stack direction="row" spacing={1.5}>
                <Button
                  color="error"
                  startIcon={<Ban size={16} />}
                  onClick={() => setCancelOpen(true)}
                >
                  Cancelar
                </Button>
                {next && (
                  <Button
                    fullWidth
                    variant="contained"
                    endIcon={<ArrowRight size={16} />}
                    onClick={() => onAdvance(order)}
                  >
                    Avanzar a "{ORDER_STATUS_LABELS[next]}"
                  </Button>
                )}
              </Stack>
            </Can>
          ) : undefined
        }
      >
        <Stack spacing={3}>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Printer size={16} />}
              onClick={() => printTicket(order)}
            >
              Imprimir comanda
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Receipt size={16} />}
              onClick={() => printInvoiceNow(order, payments)}
            >
              Imprimir factura
            </Button>
            {eInvoicing &&
              eInvoice?.status !== 'ISSUED' &&
              order.paymentStatus === 'PAID' &&
              order.status !== 'CANCELLED' && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<FileCheck size={16} />}
                  onClick={() => setEInvoiceOpen(true)}
                >
                  Factura electrónica
                </Button>
              )}
            {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
              <Can permission="orders.update">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Pencil size={16} />}
                  onClick={() => setEditItemsOpen(true)}
                >
                  Editar productos
                </Button>
              </Can>
            )}
            {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
              <Can permission="orders.update">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Plus size={16} />}
                  onClick={() => setAddItemsOpen(true)}
                >
                  Agregar productos
                </Button>
              </Can>
            )}
          </Stack>

          {eInvoicing && eInvoice && (
            <Alert
              severity={eInvoice.status === 'ISSUED' ? 'success' : 'error'}
              icon={<FileCheck size={20} />}
              action={
                eInvoice.status === 'ISSUED' ? (
                  <Stack direction="row" spacing={0.5}>
                    <Button
                      size="small"
                      color="inherit"
                      startIcon={<FileText size={14} />}
                      onClick={() => void openEInvoicePdf(eInvoice.id)}
                    >
                      PDF
                    </Button>
                    <Button
                      size="small"
                      color="inherit"
                      startIcon={<Printer size={14} />}
                      onClick={() => void printElectronicInvoice(order, payments, eInvoice)}
                    >
                      Imprimir
                    </Button>
                  </Stack>
                ) : undefined
              }
            >
              {eInvoice.status === 'ISSUED' ? (
                <>
                  Factura electrónica <b>{eInvoice.number}</b>
                  {eInvoice.environment === 'SANDBOX' ? ' (pruebas)' : ''} ·{' '}
                  {eInvoice.customer.kind === 'IDENTIFIED'
                    ? eInvoice.customer.name
                    : 'Consumidor final'}
                </>
              ) : (
                <>No se pudo emitir: {eInvoice.errorMessage}. Corrige y vuelve a intentar.</>
              )}
            </Alert>
          )}

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Cliente
            </Typography>
            <Typography variant="body2">{customerName(order)}</Typography>
            {order.tableNumber && (
              <Typography variant="caption" color="text.secondary">
                {getOrderIdentifierLabel(order, tableNames)}
              </Typography>
            )}
            {order.deliveryAddress && (
              <Stack
                direction="row"
                spacing={0.5}
                sx={{ alignItems: 'flex-start', color: 'text.secondary', mt: 0.5 }}
              >
                <MapPin size={13} style={{ marginTop: 2 }} />
                <Typography variant="caption">{order.deliveryAddress}</Typography>
              </Stack>
            )}
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Productos
            </Typography>
            <Stack spacing={1.5}>
              {order.items.map((item) => (
                <Stack key={item.id} direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.quantity}× {item.productNameSnapshot}
                    </Typography>
                    {item.optionSelections.length > 0 && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        <OptionSelectionsText item={item} />
                      </Typography>
                    )}
                    {item.notes && (
                      <Typography variant="caption" color="text.secondary">
                        Nota: {item.notes}
                      </Typography>
                    )}
                  </Box>
                  <CurrencyDisplay value={item.totalPrice} variant="body2" />
                </Stack>
              ))}
            </Stack>
          </Box>

          <Divider />

          <Stack spacing={0.75}>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Subtotal
              </Typography>
              <CurrencyDisplay value={order.subtotal} variant="body2" />
            </Stack>
            {order.discountAmount > 0 && (
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  {order.discountLabel ?? 'Descuento'}
                </Typography>
                <CurrencyDisplay value={-order.discountAmount} variant="body2" />
              </Stack>
            )}
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Impuestos
              </Typography>
              <CurrencyDisplay value={order.taxAmount} variant="body2" />
            </Stack>
            {order.deliveryFee > 0 && (
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Domicilio
                </Typography>
                <CurrencyDisplay value={order.deliveryFee} variant="body2" />
              </Stack>
            )}
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Total
              </Typography>
              <CurrencyDisplay
                value={order.totalAmount}
                variant="subtitle1"
                sx={{ fontWeight: 700 }}
              />
            </Stack>
          </Stack>

          {order.notes && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Notas
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {order.notes}
                </Typography>
              </Box>
            </>
          )}

          <Divider />

          <Box>
            <Stack
              direction="row"
              sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Pagos
              </Typography>
              <StatusChip
                label={PAYMENT_STATUS_LABELS[order.paymentStatus]}
                tone={PAYMENT_STATUS_TONE[order.paymentStatus]}
              />
            </Stack>
            <Stack spacing={1}>
              {payments.map((payment) =>
                editingPaymentId === payment.id ? (
                  <Stack key={payment.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <TextField
                      select
                      size="small"
                      value={editMethod}
                      onChange={(e) => setEditMethod(e.target.value as PaymentMethod)}
                      sx={{ minWidth: 140 }}
                    >
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <IconButton
                      size="small"
                      color="primary"
                      disabled={updatePaymentMethod.isPending}
                      onClick={() => handleSavePaymentMethod(payment.id)}
                    >
                      <Check size={16} />
                    </IconButton>
                    <IconButton size="small" onClick={() => setEditingPaymentId(null)}>
                      <X size={16} />
                    </IconButton>
                  </Stack>
                ) : (
                  <Stack
                    key={payment.id}
                    direction="row"
                    sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <Typography variant="body2">
                        {PAYMENT_METHOD_LABELS[payment.paymentMethod]}
                        {payment.payerLabel && (
                          <Typography component="span" variant="caption" color="text.secondary">
                            {' '}
                            · {payment.payerLabel}
                          </Typography>
                        )}
                      </Typography>
                      <Can permission="orders.update">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingPaymentId(payment.id);
                            setEditMethod(payment.paymentMethod);
                          }}
                        >
                          <Pencil size={13} />
                        </IconButton>
                      </Can>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <CurrencyDisplay value={payment.amount} variant="body2" />
                      <DateDisplay
                        value={payment.paidAt}
                        mode="time"
                        variant="caption"
                        color="text.secondary"
                      />
                    </Stack>
                  </Stack>
                ),
              )}
              {payments.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Sin pagos registrados.
                </Typography>
              )}
            </Stack>

            <OrderDiscountSection order={order} amountPaid={amountPaid} />

            {canRegisterPayment && (
              <Can permission="orders.update">
                <Button
                  size="small"
                  startIcon={<Users size={15} />}
                  onClick={() => setSplitBillOpen(true)}
                  sx={{ mt: 1.5 }}
                >
                  Dividir cuenta
                </Button>
                <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}>
                  <TextField
                    select
                    size="small"
                    label="Método"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    sx={{ minWidth: 140 }}
                  >
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <CurrencyField
                    size="small"
                    label="Monto"
                    value={paymentAmount}
                    onChange={setPaymentAmount}
                    placeholder={String(balanceDue)}
                    sx={{ width: 140 }}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<CreditCard size={15} />}
                    onClick={handleRegisterPayment}
                    disabled={createPayment.isPending}
                  >
                    Registrar
                  </Button>
                </Stack>
                {paymentMethod === 'CASH' && (
                  <CashChangeCalculator
                    amountDue={paymentAmount === '' ? balanceDue : Number(paymentAmount)}
                  />
                )}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  Saldo pendiente: {balanceDue}
                </Typography>
              </Can>
            )}
          </Box>
        </Stack>
      </DetailDrawer>

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Cancelar pedido</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Esta acción marcará el pedido como cancelado. Indica el motivo para dejar trazabilidad.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Motivo de la cancelación"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            multiline
            minRows={2}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCancelOpen(false)} color="inherit">
            Volver
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              onCancel(order, cancelReason || 'Cancelado por el operador');
              setCancelOpen(false);
              setCancelReason('');
            }}
          >
            Cancelar pedido
          </Button>
        </DialogActions>
      </Dialog>

      {eInvoicing && (
        <EInvoiceDialog
          open={eInvoiceOpen}
          order={order}
          sandbox={eInvoicingSandbox}
          onClose={() => setEInvoiceOpen(false)}
          onIssued={(invoice) => {
            setEInvoiceOpen(false);
            enqueueSnackbar(`Factura electrónica ${invoice.number} emitida`, {
              variant: 'success',
            });
            void printElectronicInvoice(order, payments, invoice);
          }}
        />
      )}

      <SplitBillDialog
        open={splitBillOpen}
        orderId={order.id}
        balanceDue={balanceDue}
        onClose={() => setSplitBillOpen(false)}
        onDone={() => {
          setSplitBillOpen(false);
          printInvoiceByOrderId(order.id).catch(() => {
            // Si falla la carga de datos para la factura, el usuario puede reimprimirla manualmente.
          });
        }}
      />

      <EditOrderItemsDrawer
        open={editItemsOpen}
        order={order}
        loading={replaceItems.isPending}
        onClose={() => setEditItemsOpen(false)}
        onSubmit={(values) => {
          replaceItems.mutate(
            { id: order.id, items: values.items },
            {
              onSuccess: () => {
                setEditItemsOpen(false);
                enqueueSnackbar('Pedido actualizado correctamente', { variant: 'success' });
              },
              onError: (error) =>
                enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
            },
          );
        }}
      />

      <AddOrderItemsDrawer
        open={addItemsOpen}
        order={order}
        loading={addItems.isPending}
        onClose={() => setAddItemsOpen(false)}
        onSubmit={(items) => {
          addItems.mutate(
            { id: order.id, items },
            {
              onSuccess: () => {
                setAddItemsOpen(false);
                enqueueSnackbar('Productos agregados al pedido', { variant: 'success' });
              },
              onError: (error) =>
                enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
            },
          );
        }}
      />
    </>
  );
}
