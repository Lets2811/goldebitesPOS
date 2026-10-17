export type EInvoicingEnvironment = 'SANDBOX' | 'PRODUCTION';

/** The tax a business charges on sales: '04' INC (impuesto al consumo) or '01' IVA. */
export type EInvoiceTaxCode = '01' | '04';

/** A business's connection to its Factus account (secrets already decrypted). */
export interface FactusCredentials {
  environment: EInvoicingEnvironment;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

export interface EInvoicingSettingsRow {
  business_id: string;
  environment: EInvoicingEnvironment;
  client_id: string;
  client_secret_encrypted: string;
  username: string;
  password_encrypted: string;
  numbering_range_id: number | null;
  tax_code: EInvoiceTaxCode;
  updated_at: Date;
}

/** What the platform admin sees: never the secrets themselves. */
export interface EInvoicingSettingsView {
  configured: boolean;
  environment: EInvoicingEnvironment | null;
  clientId: string | null;
  username: string | null;
  numberingRangeId: number | null;
  taxCode: EInvoiceTaxCode;
  hasSecrets: boolean;
  /** Whether the server can encrypt credentials at all (CREDENTIALS_ENCRYPTION_KEY set). */
  encryptionReady: boolean;
  updatedAt: Date | null;
}

/** Identity document codes DIAN accepts for a buyer. */
export const BUYER_DOCUMENT_CODES = [
  '13',
  '31',
  '22',
  '41',
  '48',
  '12',
  '21',
  '42',
  '47',
  '50',
  '11',
  '91',
] as const;
export type BuyerDocumentCode = (typeof BUYER_DOCUMENT_CODES)[number];

export type EInvoiceBuyer =
  | { kind: 'FINAL_CONSUMER' }
  | {
      kind: 'IDENTIFIED';
      documentCode: BuyerDocumentCode;
      identification: string;
      dv?: string;
      /** NATURAL: a person (names); JURIDICA: a company (company name). */
      legalOrganization: 'NATURAL' | 'JURIDICA';
      name: string;
      email?: string;
      phone?: string;
      address?: string;
    };

export type EInvoiceStatus = 'ISSUED' | 'FAILED';

export interface ElectronicInvoiceRow {
  id: string;
  business_id: string;
  order_id: string;
  reference_code: string;
  status: EInvoiceStatus;
  environment: EInvoicingEnvironment;
  number: string | null;
  cufe: string | null;
  qr_url: string | null;
  public_url: string | null;
  customer: EInvoiceBuyer;
  total: string | null;
  error_message: string | null;
  issued_at: Date | null;
  created_at: Date;
}

export interface ElectronicInvoice {
  id: string;
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
  issuedAt: Date | null;
  createdAt: Date;
}

export interface NumberingRange {
  id: number;
  document: string;
  prefix: string;
  from: number | null;
  to: number | null;
  current: number | null;
  resolutionNumber: string | null;
  endDate: string | null;
  isExpired: boolean;
  isActive: boolean;
}
