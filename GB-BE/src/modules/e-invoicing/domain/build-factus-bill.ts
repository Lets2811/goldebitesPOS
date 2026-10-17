import { BusinessRuleException } from '../../../common/exceptions';
import { EInvoiceBuyer, EInvoiceTaxCode } from './e-invoice.types';

/** What the builder needs from an order (all amounts as the POS computed them). */
export interface BillOrder {
  id: string;
  orderNumber: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  deliveryFee: number;
  totalAmount: number;
  items: {
    productId: string | null;
    name: string;
    note?: string;
    quantity: number;
    unitPrice: number;
    /** The line's own discount. */
    discountAmount: number;
    /** unitPrice × quantity − discountAmount. */
    totalPrice: number;
  }[];
}

export interface BillPayment {
  method: string;
  amount: number;
}

export interface BuiltBill {
  payload: Record<string, unknown>;
  /** The total the provider will compute (tax per line), before cash rounding. */
  providerTotal: number;
  cashRounding: number;
}

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
const money = (value: number) => round2(value).toFixed(2);

/** POS payment methods → DIAN payment method codes. */
export const PAYMENT_METHOD_CODES: Record<string, string> = {
  CASH: '10',
  CARD: '48',
  TRANSFER: '47',
  NEQUI: '47',
  DAVIPLATA: '47',
  OTHER: 'ZZZ',
};

/** Anonymous sale: the identity DIAN uses for "consumidor final". */
const FINAL_CONSUMER = {
  identification_document_code: '13',
  identification: '222222222222',
  names: 'Consumidor Final',
  legal_organization_code: '2',
};

function customerFor(buyer: EInvoiceBuyer): Record<string, unknown> {
  if (buyer.kind === 'FINAL_CONSUMER') return { ...FINAL_CONSUMER };
  const person = buyer.legalOrganization === 'NATURAL';
  return {
    identification_document_code: buyer.documentCode,
    identification: buyer.identification.replace(/\D/g, ''),
    ...(buyer.dv ? { dv: buyer.dv } : {}),
    legal_organization_code: person ? '2' : '1',
    ...(person ? { names: buyer.name } : { company: buyer.name }),
    tribute_code: 'ZZ',
    ...(buyer.email ? { email: buyer.email } : {}),
    ...(buyer.phone ? { phone: buyer.phone } : {}),
    ...(buyer.address ? { address: buyer.address } : {}),
  };
}

/** Whether a quantity fits the provider's two decimals. */
const fitsTwoDecimals = (quantity: number) =>
  Math.abs(quantity * 100 - Math.round(quantity * 100)) < 1e-9;

/**
 * Turns a paid order into a Factus v2 "factura electrónica de venta", so its
 * total matches what the customer paid to the cent:
 *  - prices are net (the POS adds tax on top), like Factus v2 expects;
 *  - the order's discount is spread over the lines by their weight, so tax
 *    falls on the discounted base, as the POS computed it;
 *  - the tax rate comes from the order itself (what was charged then);
 *  - the delivery fee is its own line, excluded from tax;
 *  - Factus taxes each line and rounds per line; any cents of difference with
 *    the POS total go in cash_rounding_amount (payments = total + rounding).
 */
export function buildFactusBill(input: {
  order: BillOrder;
  payments: BillPayment[];
  buyer: EInvoiceBuyer;
  taxCode: EInvoiceTaxCode;
  numberingRangeId: number | null;
  referenceCode: string;
}): BuiltBill {
  const { order, payments, buyer, taxCode, numberingRangeId, referenceCode } =
    input;
  if (order.items.length === 0) {
    throw new BusinessRuleException(
      'The order has no items to invoice',
      'EINVOICE_EMPTY_ORDER',
    );
  }

  const taxableBase = round2(order.subtotal - order.discountAmount);
  // The rate the order was charged with (e.g. 8.00), not today's setting.
  const ratePercent =
    taxableBase > 0 ? round2((order.taxAmount / taxableBase) * 100) : 0;

  // Spread the order discount over the lines, the last one taking the remainder.
  const lineNets = order.items.map((item) => round2(item.totalPrice));
  const netSum = round2(lineNets.reduce((sum, value) => sum + value, 0));
  let remaining = round2(order.discountAmount);
  const allocations = lineNets.map((net, index) => {
    if (index === lineNets.length - 1) return remaining;
    const share =
      netSum > 0 ? round2((order.discountAmount * net) / netSum) : 0;
    remaining = round2(remaining - share);
    return share;
  });

  let providerTotal = 0;
  const items = order.items.map((item, index) => {
    const gross = round2(item.unitPrice * item.quantity);
    const discount = round2(item.discountAmount + allocations[index]);
    const net = round2(gross - discount);
    const tax = ratePercent > 0 ? round2((net * ratePercent) / 100) : 0;
    providerTotal += net + tax;
    // A fractional quantity the provider can't express (3 decimals) goes as one unit of the line.
    const [quantity, price] = fitsTwoDecimals(item.quantity)
      ? [item.quantity, item.unitPrice]
      : [1, gross];
    return {
      code_reference: (item.productId ?? `ITEM-${index + 1}`).slice(0, 36),
      name: fitsTwoDecimals(item.quantity)
        ? item.name
        : `${item.name} (${item.quantity})`,
      ...(item.note ? { note: item.note } : {}),
      quantity: money(quantity),
      price: money(price),
      ...(discount > 0
        ? { discount_amount: money(discount) }
        : { discount_rate: '0.00' }),
      unit_measure_code: '94',
      standard_code: '999',
      taxes: [
        ratePercent > 0
          ? { code: taxCode, rate: money(ratePercent) }
          : { code: taxCode, rate: '0.00', is_excluded: true },
      ],
    };
  });

  if (order.deliveryFee > 0) {
    providerTotal += round2(order.deliveryFee);
    items.push({
      code_reference: 'DOMICILIO',
      name: 'Domicilio',
      quantity: '1.00',
      price: money(order.deliveryFee),
      discount_rate: '0.00',
      unit_measure_code: '94',
      standard_code: '999',
      taxes: [{ code: taxCode, rate: '0.00', is_excluded: true }],
    });
  }
  providerTotal = round2(providerTotal);

  const cashRounding = round2(order.totalAmount - providerTotal);
  if (Math.abs(cashRounding) > 500) {
    throw new BusinessRuleException(
      `The order total (${order.totalAmount}) and the invoice total (${providerTotal}) differ by more than the allowed rounding`,
      'EINVOICE_TOTAL_MISMATCH',
    );
  }

  // One payment line per DIAN method, adding up to what was paid.
  const byCode = new Map<string, number>();
  for (const payment of payments) {
    const code = PAYMENT_METHOD_CODES[payment.method] ?? 'ZZZ';
    byCode.set(code, round2((byCode.get(code) ?? 0) + payment.amount));
  }
  const paid = round2(
    [...byCode.values()].reduce((sum, value) => sum + value, 0),
  );
  if (paid !== round2(order.totalAmount)) {
    throw new BusinessRuleException(
      'The order must be fully paid before it is invoiced electronically',
      'EINVOICE_ORDER_NOT_PAID',
    );
  }

  const payload: Record<string, unknown> = {
    reference_code: referenceCode,
    document: '01',
    ...(numberingRangeId ? { numbering_range_id: numberingRangeId } : {}),
    operation_type: '10',
    observation: `Pedido ${order.orderNumber}`,
    payment_details: [...byCode.entries()].map(([code, amount]) => ({
      payment_form: '1',
      payment_method_code: code,
      amount: money(amount),
    })),
    ...(cashRounding !== 0
      ? { cash_rounding_amount: money(cashRounding) }
      : {}),
    send_email: buyer.kind === 'IDENTIFIED' && Boolean(buyer.email),
    customer: customerFor(buyer),
    items,
  };
  return { payload, providerTotal, cashRounding };
}
