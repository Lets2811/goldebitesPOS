export type EInvoicingEnvironment = 'SANDBOX' | 'PRODUCTION';
export type EInvoiceTaxCode = '04' | '01';

/** Documentos de identidad que acepta la DIAN para el comprador. */
export const BUYER_DOCUMENTS: { code: string; label: string }[] = [
  { code: '13', label: 'Cédula de ciudadanía' },
  { code: '31', label: 'NIT' },
  { code: '22', label: 'Cédula de extranjería' },
  { code: '41', label: 'Pasaporte' },
  { code: '48', label: 'PPT (Permiso por Protección Temporal)' },
  { code: '12', label: 'Tarjeta de identidad' },
  { code: '21', label: 'Tarjeta de extranjería' },
  { code: '42', label: 'Documento extranjero' },
  { code: '47', label: 'PEP' },
  { code: '50', label: 'NIT de otro país' },
];

export type EInvoiceBuyer =
  | { kind: 'FINAL_CONSUMER' }
  | {
      kind: 'IDENTIFIED';
      documentCode: string;
      identification: string;
      dv?: string;
      legalOrganization: 'NATURAL' | 'JURIDICA';
      name: string;
      email?: string;
      phone?: string;
      address?: string;
    };

export interface ElectronicInvoice {
  id: string;
  orderId: string;
  referenceCode: string;
  status: 'ISSUED' | 'FAILED';
  environment: EInvoicingEnvironment;
  number: string | null;
  cufe: string | null;
  qrUrl: string | null;
  publicUrl: string | null;
  customer: EInvoiceBuyer;
  total: number | null;
  errorMessage: string | null;
  issuedAt: string | null;
  createdAt: string;
}

export interface EInvoicingStatus {
  configured: boolean;
  environment: EInvoicingEnvironment | null;
}

export interface EInvoicingSettings {
  configured: boolean;
  environment: EInvoicingEnvironment | null;
  clientId: string | null;
  username: string | null;
  numberingRangeId: number | null;
  taxCode: EInvoiceTaxCode;
  hasSecrets: boolean;
  encryptionReady: boolean;
  updatedAt: string | null;
}

export interface EInvoicingSettingsPayload {
  environment: EInvoicingEnvironment;
  clientId: string;
  clientSecret?: string;
  username: string;
  password?: string;
  numberingRangeId?: number | null;
  taxCode: EInvoiceTaxCode;
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
}
