import { Injectable } from '@nestjs/common';
import {
  BusinessRuleException,
  EntityNotFoundException,
} from '../../../common/exceptions';
import {
  isSecretBoxConfigured,
  openSecret,
  sealSecret,
} from '../../../common/utils/secret-box.util';
import { AuditService } from '../../audit/services/audit.service';
import {
  OrderPaymentStatus,
  OrderStatus,
} from '../../orders/domain/order.interface';
import { OrdersService } from '../../orders/services/orders.service';
import { PaymentsService } from '../../payments/services/payments.service';
import { buildFactusBill } from '../domain/build-factus-bill';
import {
  EInvoiceBuyer,
  EInvoiceTaxCode,
  EInvoicingEnvironment,
  EInvoicingSettingsRow,
  EInvoicingSettingsView,
  ElectronicInvoice,
  ElectronicInvoiceRow,
  FactusCredentials,
  NumberingRange,
} from '../domain/e-invoice.types';
import { FactusClient } from '../factus/factus.client';
import { EInvoicingRepository } from '../repositories/e-invoicing.repository';

export interface SettingsInput {
  environment: EInvoicingEnvironment;
  clientId: string;
  /** Omitted: keep the saved one. */
  clientSecret?: string;
  username: string;
  /** Omitted: keep the saved one. */
  password?: string;
  numberingRangeId?: number | null;
  taxCode: EInvoiceTaxCode;
}

const toInvoice = (row: ElectronicInvoiceRow): ElectronicInvoice => ({
  id: row.id,
  orderId: row.order_id,
  referenceCode: row.reference_code,
  status: row.status,
  environment: row.environment,
  number: row.number,
  cufe: row.cufe,
  qrUrl: row.qr_url,
  publicUrl: row.public_url,
  customer: row.customer,
  total: row.total === null ? null : Number(row.total),
  errorMessage: row.error_message,
  issuedAt: row.issued_at,
  createdAt: row.created_at,
});

/**
 * DIAN electronic invoicing through Factus, as an add-on: the platform admin
 * connects each business's own Factus account; the business then chooses, per
 * paid order, a simple printed invoice (as always) or an electronic one.
 */
@Injectable()
export class EInvoicingService {
  constructor(
    private readonly repository: EInvoicingRepository,
    private readonly factus: FactusClient,
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly auditService: AuditService,
  ) {}

  // ------------------------------------------------------------------ settings (platform admin)

  async getSettings(businessId: string): Promise<EInvoicingSettingsView> {
    const row = await this.repository.findSettings(businessId);
    return {
      configured: Boolean(row),
      environment: row?.environment ?? null,
      clientId: row?.client_id ?? null,
      username: row?.username ?? null,
      numberingRangeId: row?.numbering_range_id ?? null,
      taxCode: row?.tax_code ?? '04',
      hasSecrets: Boolean(row),
      encryptionReady: isSecretBoxConfigured(),
      updatedAt: row?.updated_at ?? null,
    };
  }

  async saveSettings(
    businessId: string,
    input: SettingsInput,
    actorUserId?: string,
  ): Promise<EInvoicingSettingsView> {
    this.assertEncryptionReady();
    const current = await this.repository.findSettings(businessId);
    const credentials = this.mergeCredentials(input, current);
    await this.repository.saveSettings(businessId, {
      environment: input.environment,
      clientId: credentials.clientId,
      clientSecretEncrypted: sealSecret(credentials.clientSecret),
      username: credentials.username,
      passwordEncrypted: sealSecret(credentials.password),
      numberingRangeId: input.numberingRangeId ?? null,
      taxCode: input.taxCode,
      updatedBy: actorUserId,
    });
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'e_invoicing_settings',
      entityId: businessId,
      action: current ? 'UPDATE' : 'CREATE',
      // Never the secrets.
      newValues: {
        environment: input.environment,
        clientId: input.clientId,
        username: input.username,
        numberingRangeId: input.numberingRangeId ?? null,
        taxCode: input.taxCode,
      },
    });
    return this.getSettings(businessId);
  }

  /** Logs in with the given (or saved) credentials and lists the account's active invoice ranges. */
  async testConnection(
    businessId: string,
    input?: SettingsInput,
  ): Promise<NumberingRange[]> {
    const current = await this.repository.findSettings(businessId);
    if (!input && !current) {
      throw new BusinessRuleException(
        'No credentials to test',
        'EINVOICING_NOT_CONFIGURED',
      );
    }
    const credentials = input
      ? this.mergeCredentials(input, current)
      : this.credentialsOf(current!);
    const ranges = await this.factus.listNumberingRanges(credentials);
    return ranges.filter(
      (range) => /factura/i.test(range.document) && range.isActive,
    );
  }

  // ------------------------------------------------------------------ invoicing (the business)

  async status(businessId: string): Promise<{
    configured: boolean;
    environment: EInvoicingEnvironment | null;
  }> {
    const row = await this.repository.findSettings(businessId);
    return { configured: Boolean(row), environment: row?.environment ?? null };
  }

  async findForOrder(
    businessId: string,
    orderId: string,
  ): Promise<ElectronicInvoice | null> {
    const row = await this.repository.findByOrder(businessId, orderId);
    return row ? toInvoice(row) : null;
  }

  async issue(
    businessId: string,
    orderId: string,
    buyer: EInvoiceBuyer,
    actorUserId?: string,
  ): Promise<ElectronicInvoice> {
    const settings = await this.repository.findSettings(businessId);
    if (!settings) {
      throw new BusinessRuleException(
        'La facturación electrónica no está configurada para este negocio.',
        'EINVOICING_NOT_CONFIGURED',
      );
    }
    const order = await this.ordersService.findOne(businessId, orderId);
    if (order.status === OrderStatus.CANCELLED) {
      throw new BusinessRuleException(
        'Un pedido cancelado no se puede facturar.',
        'EINVOICE_ORDER_CANCELLED',
      );
    }
    if (order.paymentStatus !== OrderPaymentStatus.PAID) {
      throw new BusinessRuleException(
        'El pedido debe estar pagado por completo para facturarlo.',
        'EINVOICE_ORDER_NOT_PAID',
      );
    }
    const existing = await this.repository.findByOrder(businessId, orderId);
    if (existing?.status === 'ISSUED') return toInvoice(existing);

    const payments = await this.paymentsService.findByOrder(
      businessId,
      orderId,
    );
    // Same reference on a retry: the provider answers with the document it already has.
    const referenceCode =
      existing?.reference_code ??
      `GB-${order.orderNumber}-${order.id.slice(0, 8)}`;
    const { payload } = buildFactusBill({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        taxAmount: order.taxAmount,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
        items: order.items.map((item) => ({
          productId: item.productId,
          name: item.productNameSnapshot,
          note:
            item.optionSelections
              .filter((selection) => selection.itemNames.length > 0)
              .map(
                (selection) =>
                  `${selection.groupName}: ${selection.itemNames.join(', ')}`,
              )
              .join(' · ') || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          totalPrice: item.totalPrice,
        })),
      },
      payments: payments.map((payment) => ({
        method: payment.paymentMethod,
        amount: payment.amount,
      })),
      buyer,
      taxCode: settings.tax_code,
      numberingRangeId: settings.numbering_range_id,
      referenceCode,
    });

    const response = await this.factus.validateBill(
      this.credentialsOf(settings),
      payload,
    );
    const bill = (response.body?.data ?? {}) as {
      number?: string;
      cufe?: string;
      is_validated?: boolean;
      links?: { qr?: string; public_url?: string };
      totals?: { total?: string };
    };
    const issued =
      (response.status === 200 || response.status === 201) &&
      Boolean(bill.number && bill.cufe);

    const saved = await this.repository.saveInvoice({
      businessId,
      orderId,
      referenceCode,
      status: issued ? 'ISSUED' : 'FAILED',
      environment: settings.environment,
      number: issued ? bill.number! : null,
      cufe: issued ? bill.cufe! : null,
      qrUrl: issued ? (bill.links?.qr ?? null) : null,
      publicUrl: issued ? (bill.links?.public_url ?? null) : null,
      customer: buyer,
      total: issued && bill.totals?.total ? Number(bill.totals.total) : null,
      errorMessage: issued ? null : FactusClient.errorsOf(response),
      providerResponse: response.body,
      createdBy: actorUserId,
    });
    await this.auditService.record({
      businessId,
      userId: actorUserId,
      entityType: 'electronic_invoice',
      entityId: saved.id,
      action: issued ? 'ISSUE' : 'ISSUE_FAILED',
      newValues: {
        orderId,
        number: saved.number,
        referenceCode,
        environment: settings.environment,
      },
    });
    if (!issued) {
      throw new BusinessRuleException(
        `La DIAN o el proveedor rechazaron la factura: ${saved.error_message}`,
        'EINVOICE_REJECTED',
      );
    }
    return toInvoice(saved);
  }

  async downloadPdf(
    businessId: string,
    invoiceId: string,
  ): Promise<{ fileName: string; pdf: Buffer }> {
    const invoice = await this.repository.findById(businessId, invoiceId);
    if (!invoice || invoice.status !== 'ISSUED' || !invoice.number) {
      throw new EntityNotFoundException('ElectronicInvoice', invoiceId);
    }
    const settings = await this.repository.findSettings(businessId);
    if (!settings) {
      throw new BusinessRuleException(
        'La facturación electrónica no está configurada para este negocio.',
        'EINVOICING_NOT_CONFIGURED',
      );
    }
    return this.factus.downloadPdf(
      this.credentialsOf(settings),
      invoice.number,
    );
  }

  // ------------------------------------------------------------------ helpers

  private credentialsOf(row: EInvoicingSettingsRow): FactusCredentials {
    this.assertEncryptionReady();
    return {
      environment: row.environment,
      clientId: row.client_id,
      clientSecret: openSecret(row.client_secret_encrypted),
      username: row.username,
      password: openSecret(row.password_encrypted),
    };
  }

  /** New values where given; the saved secrets where left out. */
  private mergeCredentials(
    input: SettingsInput,
    current: EInvoicingSettingsRow | null,
  ): FactusCredentials {
    const saved = current ? this.credentialsOf(current) : null;
    const clientSecret = input.clientSecret || saved?.clientSecret;
    const password = input.password || saved?.password;
    if (!clientSecret || !password) {
      throw new BusinessRuleException(
        'Client secret and password are required the first time',
        'EINVOICING_SECRETS_REQUIRED',
      );
    }
    return {
      environment: input.environment,
      clientId: input.clientId,
      clientSecret,
      username: input.username,
      password,
    };
  }

  private assertEncryptionReady(): void {
    if (!isSecretBoxConfigured()) {
      throw new BusinessRuleException(
        'El servidor no tiene configurada la clave de cifrado (CREDENTIALS_ENCRYPTION_KEY): no se pueden guardar ni usar credenciales de facturación.',
        'EINVOICING_ENCRYPTION_NOT_CONFIGURED',
      );
    }
  }
}
