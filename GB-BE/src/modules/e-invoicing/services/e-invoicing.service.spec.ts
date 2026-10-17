import { openSecret } from '../../../common/utils/secret-box.util';
import {
  OrderPaymentStatus,
  OrderStatus,
} from '../../orders/domain/order.interface';
import { EInvoicingService } from './e-invoicing.service';

describe('EInvoicingService', () => {
  const businessId = 'b1';
  const orderId = '0b6c1f3e-aaaa-bbbb-cccc-123456789012';
  let repository: Record<string, jest.Mock>;
  let factus: Record<string, jest.Mock>;
  let ordersService: { findOne: jest.Mock };
  let paymentsService: { findByOrder: jest.Mock };
  let auditService: { record: jest.Mock };
  let service: EInvoicingService;
  let savedSettings: Record<string, unknown> | null;

  const paidOrder = {
    id: orderId,
    orderNumber: '1017-05',
    status: OrderStatus.DELIVERED,
    paymentStatus: OrderPaymentStatus.PAID,
    subtotal: 22000,
    discountAmount: 0,
    taxAmount: 1760,
    deliveryFee: 0,
    totalAmount: 23760,
    items: [
      {
        productId: 'p1',
        productNameSnapshot: 'Hamburguesa',
        quantity: 1,
        unitPrice: 22000,
        discountAmount: 0,
        totalPrice: 22000,
        optionSelections: [{ groupName: 'Salsas', itemNames: ['BBQ'] }],
      },
    ],
  };

  beforeAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY =
      'test-key-for-unit-tests-0123456789';
  });

  beforeEach(async () => {
    savedSettings = null;
    repository = {
      findSettings: jest.fn(() => Promise.resolve(savedSettings)),
      saveSettings: jest.fn((_id: string, data: Record<string, unknown>) => {
        savedSettings = {
          business_id: businessId,
          environment: data.environment,
          client_id: data.clientId,
          client_secret_encrypted: data.clientSecretEncrypted,
          username: data.username,
          password_encrypted: data.passwordEncrypted,
          numbering_range_id: data.numberingRangeId,
          tax_code: data.taxCode,
          updated_at: new Date(),
        };
      }),
      findByOrder: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      saveInvoice: jest.fn((data: Record<string, unknown>) =>
        Promise.resolve({
          id: 'inv-1',
          order_id: data.orderId,
          reference_code: data.referenceCode,
          status: data.status,
          environment: data.environment,
          number: data.number,
          cufe: data.cufe,
          qr_url: data.qrUrl,
          public_url: data.publicUrl,
          customer: data.customer,
          total: data.total === null ? null : String(data.total as number),
          error_message: data.errorMessage,
          issued_at: data.status === 'ISSUED' ? new Date() : null,
          created_at: new Date(),
        }),
      ),
    };
    factus = {
      validateBill: jest.fn(),
      listNumberingRanges: jest.fn(),
      downloadPdf: jest.fn(),
    };
    ordersService = { findOne: jest.fn().mockResolvedValue(paidOrder) };
    paymentsService = {
      findByOrder: jest
        .fn()
        .mockResolvedValue([{ paymentMethod: 'CASH', amount: 23760 }]),
    };
    auditService = { record: jest.fn() };
    service = new EInvoicingService(
      repository as never,
      factus as never,
      ordersService as never,
      paymentsService as never,
      auditService as never,
    );
    await service.saveSettings(businessId, {
      environment: 'SANDBOX',
      clientId: 'cid',
      clientSecret: 'the-secret',
      username: 'u@x.co',
      password: 'the-password',
      numberingRangeId: 389,
      taxCode: '04',
    });
    auditService.record.mockClear();
  });

  it('keeps credentials encrypted, never in clear text nor in the audit log', async () => {
    const saved = savedSettings!;
    expect(saved.client_secret_encrypted).not.toContain('the-secret');
    expect(openSecret(saved.password_encrypted as string)).toBe('the-password');

    await service.saveSettings(
      businessId,
      {
        environment: 'PRODUCTION',
        clientId: 'cid',
        username: 'u@x.co',
        taxCode: '04',
      },
      'admin',
    );
    // Secrets left out keep the saved ones.
    expect(openSecret(savedSettings!.client_secret_encrypted as string)).toBe(
      'the-secret',
    );
    expect(JSON.stringify(auditService.record.mock.calls)).not.toMatch(
      /the-secret|the-password/,
    );
  });

  it('issues the invoice and stores number, CUFE and links', async () => {
    factus.validateBill.mockResolvedValue({
      status: 201,
      body: {
        data: {
          number: 'SETP990000001',
          cufe: 'abc123',
          is_validated: true,
          links: { qr: 'https://dian/qr', public_url: 'https://factus/doc' },
          totals: { total: '23760.00' },
        },
      },
    });

    const invoice = await service.issue(
      businessId,
      orderId,
      { kind: 'FINAL_CONSUMER' },
      'cashier',
    );

    expect(invoice).toMatchObject({
      status: 'ISSUED',
      number: 'SETP990000001',
      cufe: 'abc123',
      qrUrl: 'https://dian/qr',
      total: 23760,
    });
    const [credentials, payload] = factus.validateBill.mock.calls[0] as [
      { clientSecret: string },
      { reference_code: string; numbering_range_id: number },
    ];
    expect(credentials.clientSecret).toBe('the-secret');
    expect(payload.reference_code).toBe('GB-1017-05-0b6c1f3e');
    expect(payload.numbering_range_id).toBe(389);
  });

  it('records a rejection with the provider errors, and retries with the same reference', async () => {
    factus.validateBill.mockResolvedValue({
      status: 422,
      body: {
        message: 'Error de validación',
        data: { errors: { 'customer.identification': ['no es válido'] } },
      },
    });

    await expect(
      service.issue(businessId, orderId, { kind: 'FINAL_CONSUMER' }),
    ).rejects.toMatchObject({ code: 'EINVOICE_REJECTED' });
    const failed = (repository.saveInvoice.mock.calls[0] as unknown[])[0] as {
      status: string;
      errorMessage: string;
    };
    expect(failed.status).toBe('FAILED');
    expect(failed.errorMessage).toContain(
      'customer.identification: no es válido',
    );

    repository.findByOrder.mockResolvedValue({
      status: 'FAILED',
      reference_code: 'GB-1017-05-0b6c1f3e',
    });
    factus.validateBill.mockResolvedValue({
      status: 201,
      body: { data: { number: 'N1', cufe: 'C1', links: {} } },
    });
    await service.issue(businessId, orderId, { kind: 'FINAL_CONSUMER' });
    expect(
      (
        factus.validateBill.mock.calls[1] as [
          unknown,
          { reference_code: string },
        ]
      )[1].reference_code,
    ).toBe('GB-1017-05-0b6c1f3e');
  });

  it('returns the existing invoice instead of issuing a second one', async () => {
    repository.findByOrder.mockResolvedValue({
      id: 'inv-0',
      status: 'ISSUED',
      number: 'N0',
      customer: { kind: 'FINAL_CONSUMER' },
      total: '23760.00',
    });

    const invoice = await service.issue(businessId, orderId, {
      kind: 'FINAL_CONSUMER',
    });

    expect(invoice.number).toBe('N0');
    expect(factus.validateBill).not.toHaveBeenCalled();
  });

  it('refuses unpaid or cancelled orders, and businesses not connected', async () => {
    ordersService.findOne.mockResolvedValue({
      ...paidOrder,
      paymentStatus: OrderPaymentStatus.PARTIALLY_PAID,
    });
    await expect(
      service.issue(businessId, orderId, { kind: 'FINAL_CONSUMER' }),
    ).rejects.toMatchObject({ code: 'EINVOICE_ORDER_NOT_PAID' });

    ordersService.findOne.mockResolvedValue({
      ...paidOrder,
      status: OrderStatus.CANCELLED,
    });
    await expect(
      service.issue(businessId, orderId, { kind: 'FINAL_CONSUMER' }),
    ).rejects.toMatchObject({ code: 'EINVOICE_ORDER_CANCELLED' });

    savedSettings = null;
    await expect(
      service.issue(businessId, orderId, { kind: 'FINAL_CONSUMER' }),
    ).rejects.toMatchObject({ code: 'EINVOICING_NOT_CONFIGURED' });
    expect(factus.validateBill).not.toHaveBeenCalled();
  });
});
