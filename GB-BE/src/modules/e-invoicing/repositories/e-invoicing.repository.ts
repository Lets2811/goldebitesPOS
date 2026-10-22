import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import {
  EInvoiceBuyer,
  EInvoiceStatus,
  EInvoiceTaxCode,
  EInvoicingEnvironment,
  EInvoicingSettingsRow,
  ElectronicInvoiceRow,
} from '../domain/e-invoice.types';

const INVOICE_COLUMNS = `id, business_id, order_id, reference_code, status, environment, number, cufe,
  qr_url, public_url, customer, total::text AS total, error_message, issued_at, created_at`;

export interface SaveSettingsData {
  environment: EInvoicingEnvironment;
  clientId: string;
  clientSecretEncrypted: string;
  username: string;
  passwordEncrypted: string;
  numberingRangeId: number | null;
  taxCode: EInvoiceTaxCode;
  updatedBy?: string;
}

export interface SaveInvoiceData {
  businessId: string;
  orderId: string;
  referenceCode: string;
  status: EInvoiceStatus;
  environment: EInvoicingEnvironment;
  number: string | null;
  cufe: string | null;
  qrUrl: string | null;
  publicUrl: string | null;
  customer: EInvoiceBuyer;
  total: number | null;
  errorMessage: string | null;
  providerResponse: unknown;
  createdBy?: string;
}

@Injectable()
export class EInvoicingRepository {
  constructor(private readonly db: DatabaseService) {}

  async findSettings(
    businessId: string,
  ): Promise<EInvoicingSettingsRow | null> {
    const result = await this.db.query<EInvoicingSettingsRow>(
      `SELECT business_id, environment, client_id, client_secret_encrypted, username, password_encrypted,
              numbering_range_id, tax_code, updated_at
       FROM e_invoicing_settings WHERE business_id = $1`,
      [businessId],
    );
    return result.rows[0] ?? null;
  }

  async saveSettings(
    businessId: string,
    data: SaveSettingsData,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO e_invoicing_settings
         (business_id, environment, client_id, client_secret_encrypted, username, password_encrypted, numbering_range_id, tax_code, updated_by)
       -- updated_by keeps POS users only; the Golden Bites team (who sets this
       -- up from the Admin app) is recorded in the audit log instead.
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, (SELECT id FROM users WHERE id = $9::uuid))
       ON CONFLICT (business_id) DO UPDATE SET
         environment = EXCLUDED.environment, client_id = EXCLUDED.client_id,
         client_secret_encrypted = EXCLUDED.client_secret_encrypted, username = EXCLUDED.username,
         password_encrypted = EXCLUDED.password_encrypted, numbering_range_id = EXCLUDED.numbering_range_id,
         tax_code = EXCLUDED.tax_code, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [
        businessId,
        data.environment,
        data.clientId,
        data.clientSecretEncrypted,
        data.username,
        data.passwordEncrypted,
        data.numberingRangeId,
        data.taxCode,
        data.updatedBy ?? null,
      ],
    );
  }

  async findByOrder(
    businessId: string,
    orderId: string,
  ): Promise<ElectronicInvoiceRow | null> {
    const result = await this.db.query<ElectronicInvoiceRow>(
      `SELECT ${INVOICE_COLUMNS} FROM electronic_invoices WHERE business_id = $1 AND order_id = $2`,
      [businessId, orderId],
    );
    return result.rows[0] ?? null;
  }

  async findById(
    businessId: string,
    id: string,
  ): Promise<ElectronicInvoiceRow | null> {
    const result = await this.db.query<ElectronicInvoiceRow>(
      `SELECT ${INVOICE_COLUMNS} FROM electronic_invoices WHERE business_id = $1 AND id = $2`,
      [businessId, id],
    );
    return result.rows[0] ?? null;
  }

  /** One row per order: a retry overwrites the failed attempt. */
  async saveInvoice(data: SaveInvoiceData): Promise<ElectronicInvoiceRow> {
    const result = await this.db.query<ElectronicInvoiceRow>(
      `INSERT INTO electronic_invoices
         (business_id, order_id, reference_code, status, environment, number, cufe, qr_url, public_url,
          customer, total, error_message, provider_response, issued_at, created_by)
       VALUES ($1, $2, $3, $4::varchar, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13::jsonb,
               CASE WHEN $4::varchar = 'ISSUED' THEN now() END, $14)
       ON CONFLICT (order_id) DO UPDATE SET
         status = EXCLUDED.status, environment = EXCLUDED.environment, number = EXCLUDED.number,
         cufe = EXCLUDED.cufe, qr_url = EXCLUDED.qr_url, public_url = EXCLUDED.public_url,
         customer = EXCLUDED.customer, total = EXCLUDED.total, error_message = EXCLUDED.error_message,
         provider_response = EXCLUDED.provider_response, issued_at = EXCLUDED.issued_at, updated_at = now()
       RETURNING ${INVOICE_COLUMNS}`,
      [
        data.businessId,
        data.orderId,
        data.referenceCode,
        data.status,
        data.environment,
        data.number,
        data.cufe,
        data.qrUrl,
        data.publicUrl,
        JSON.stringify(data.customer),
        data.total,
        data.errorMessage,
        JSON.stringify(data.providerResponse ?? null),
        data.createdBy ?? null,
      ],
    );
    return result.rows[0];
  }
}
