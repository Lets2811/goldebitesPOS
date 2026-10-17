import { BillOrder, buildFactusBill } from './build-factus-bill';

type Item = BillOrder['items'][number];
const item = (
  name: string,
  unitPrice: number,
  quantity = 1,
  discountAmount = 0,
): Item => ({
  productId: `p-${name}`,
  name,
  quantity,
  unitPrice,
  discountAmount,
  totalPrice: Math.round((unitPrice * quantity - discountAmount) * 100) / 100,
});

/** An order as the POS totals it: tax on (subtotal − discount), delivery on top. */
function order(
  items: Item[],
  opts: { discount?: number; delivery?: number; rate?: number } = {},
): BillOrder {
  const subtotal = items.reduce((s, i) => s + i.totalPrice, 0);
  const discount = opts.discount ?? 0;
  const rate = opts.rate ?? 0.08;
  const taxAmount = Math.round((subtotal - discount) * rate * 100) / 100;
  const delivery = opts.delivery ?? 0;
  return {
    id: '0b6c1f3e-aaaa-bbbb-cccc-123456789012',
    orderNumber: '1017-05',
    subtotal,
    discountAmount: discount,
    taxAmount,
    deliveryFee: delivery,
    totalAmount:
      Math.round((subtotal - discount + taxAmount + delivery) * 100) / 100,
    items,
  };
}

const build = (
  o: BillOrder,
  payments = [{ method: 'CASH', amount: o.totalAmount }],
) =>
  buildFactusBill({
    order: o,
    payments,
    buyer: { kind: 'FINAL_CONSUMER' },
    taxCode: '04',
    numberingRangeId: 389,
    referenceCode: 'GB-1017-05-0b6c1f3e',
  });

type Line = {
  price: string;
  quantity: string;
  discount_amount?: string;
  taxes: { code: string; rate: string; is_excluded?: boolean }[];
};

describe('buildFactusBill', () => {
  it('invoices a simple order with INC 8% and net prices, totals matching the POS', () => {
    const o = order([item('Hamburguesa', 22000), item('Gaseosa', 5000, 2)]);
    const { payload, providerTotal, cashRounding } = build(o);

    expect(o.totalAmount).toBe(34560);
    expect(providerTotal).toBe(34560);
    expect(cashRounding).toBe(0);
    expect(payload.cash_rounding_amount).toBeUndefined();
    const lines = payload.items as Line[];
    expect(lines.map((l) => [l.price, l.quantity])).toEqual([
      ['22000.00', '1.00'],
      ['5000.00', '2.00'],
    ]);
    expect(lines[0].taxes).toEqual([{ code: '04', rate: '8.00' }]);
    expect(payload.customer).toEqual({
      identification_document_code: '13',
      identification: '222222222222',
      names: 'Consumidor Final',
      legal_organization_code: '2',
    });
    expect(payload.payment_details).toEqual([
      { payment_form: '1', payment_method_code: '10', amount: '34560.00' },
    ]);
  });

  it('spreads the order discount over the lines, so tax falls on the discounted base', () => {
    const o = order([item('A', 20000), item('B', 10000)], { discount: 3000 });
    const { payload, providerTotal } = build(o);

    const lines = payload.items as Line[];
    expect(lines.map((l) => l.discount_amount)).toEqual(['2000.00', '1000.00']);
    expect(providerTotal).toBe(o.totalAmount);
  });

  it('keeps a line discount and adds its share of the order discount', () => {
    const o = order([item('A', 10000, 2, 2000), item('B', 6000)], {
      discount: 2400,
    });
    const lines = build(o).payload.items as Line[];
    // A nets 18000, B 6000: A takes 3/4 of the order discount (1800) plus its own 2000.
    expect(lines.map((l) => l.discount_amount)).toEqual(['3800.00', '600.00']);
  });

  it('adds the delivery fee as its own line, excluded from tax', () => {
    const o = order([item('A', 10000)], { delivery: 5000 });
    const { payload, providerTotal } = build(o);

    const delivery = (payload.items as Line[])[1];
    expect(delivery.price).toBe('5000.00');
    expect(delivery.taxes).toEqual([
      { code: '04', rate: '0.00', is_excluded: true },
    ]);
    expect(providerTotal).toBe(15800);
  });

  it('covers the provider taxing per line with cash rounding (payments = provider total + rounding)', () => {
    const o = order([
      item('A', 3333.33),
      item('B', 3333.33),
      item('C', 3333.33),
    ]);
    const { payload, providerTotal, cashRounding } = build(o);

    expect(o.totalAmount).toBe(10799.99);
    expect(providerTotal).toBe(10800);
    expect(cashRounding).toBe(-0.01);
    expect(payload.cash_rounding_amount).toBe('-0.01');
  });

  it('groups payments by DIAN method (Nequi and transfers are both transfers)', () => {
    const o = order([item('A', 50000)]);
    const { payload } = build(o, [
      { method: 'CASH', amount: 20000 },
      { method: 'NEQUI', amount: 10000 },
      { method: 'TRANSFER', amount: 24000 },
    ]);
    expect(payload.payment_details).toEqual([
      { payment_form: '1', payment_method_code: '10', amount: '20000.00' },
      { payment_form: '1', payment_method_code: '47', amount: '34000.00' },
    ]);
  });

  it('refuses an order that is not fully paid', () => {
    const o = order([item('A', 50000)]);
    expect(() => build(o, [{ method: 'CASH', amount: 1000 }])).toThrow(
      expect.objectContaining({ code: 'EINVOICE_ORDER_NOT_PAID' }) as Error,
    );
  });

  it('marks lines excluded when the business charges no tax', () => {
    const o = order([item('A', 10000)], { rate: 0 });
    const line = (build(o).payload.items as Line[])[0];
    expect(line.taxes).toEqual([
      { code: '04', rate: '0.00', is_excluded: true },
    ]);
  });

  it('invoices an identified buyer (company with NIT) and emails it', () => {
    const o = order([item('A', 10000)]);
    const { payload } = buildFactusBill({
      order: o,
      payments: [{ method: 'CARD', amount: o.totalAmount }],
      buyer: {
        kind: 'IDENTIFIED',
        documentCode: '31',
        identification: '900.123.456',
        legalOrganization: 'JURIDICA',
        name: 'Empresa S.A.S.',
        email: 'compras@empresa.co',
      },
      taxCode: '04',
      numberingRangeId: null,
      referenceCode: 'X',
    });
    expect(payload.customer).toEqual({
      identification_document_code: '31',
      identification: '900123456',
      legal_organization_code: '1',
      company: 'Empresa S.A.S.',
      tribute_code: 'ZZ',
      email: 'compras@empresa.co',
    });
    expect(payload.send_email).toBe(true);
    expect(payload.numbering_range_id).toBeUndefined();
    expect(payload.payment_details).toEqual([
      { payment_form: '1', payment_method_code: '48', amount: '10800.00' },
    ]);
  });

  it('sends a fractional quantity the provider cannot express as one unit of the line', () => {
    const o = order([item('Queso por peso', 40000, 0.125)]);
    const line = (build(o).payload.items as Line[])[0];
    expect([line.quantity, line.price]).toEqual(['1.00', '5000.00']);
  });
});
