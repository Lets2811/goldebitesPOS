import { Injectable, Logger } from '@nestjs/common';
import { BusinessRuleException } from '../../../common/exceptions';
import {
  EInvoicingEnvironment,
  FactusCredentials,
  NumberingRange,
} from '../domain/e-invoice.types';

const BASE_URLS: Record<EInvoicingEnvironment, string> = {
  SANDBOX: 'https://api-sandbox.factus.com.co',
  PRODUCTION: 'https://api.factus.com.co',
};
const TIMEOUT_MS = 45_000;

/** A provider value as text (strings and numbers; anything else is empty). */
const text = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export interface FactusResponse {
  status: number;
  body: {
    status?: string;
    message?: string;
    data?: Record<string, unknown>;
  } | null;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Talks to Factus (DIAN technological provider), API v2, with a business's
 * own account. Tokens (an hour long) are cached per account and renewed
 * shortly before they expire, or right away if Factus rejects one.
 */
@Injectable()
export class FactusClient {
  private readonly logger = new Logger(FactusClient.name);
  private readonly tokens = new Map<string, CachedToken>();

  async listNumberingRanges(
    credentials: FactusCredentials,
  ): Promise<NumberingRange[]> {
    const response = await this.request(
      credentials,
      'GET',
      '/v2/numbering-ranges?filter%5Bis_active%5D=1',
    );
    if (response.status !== 200) throw this.failure(response);
    const data = response.body?.data as
      { data?: Record<string, unknown>[] } | undefined;
    return (data?.data ?? []).map((range) => ({
      id: Number(range.id),
      document: text(range.document),
      prefix: text(range.prefix),
      from: range.from === null ? null : Number(range.from),
      to: range.to === null ? null : Number(range.to),
      current: range.current === null ? null : Number(range.current),
      resolutionNumber: (range.resolution_number as string) || null,
      endDate: (range.end_date as string) ?? null,
      isExpired: Boolean(range.is_expired),
      isActive: Boolean(range.is_active),
    }));
  }

  /** Creates and validates an invoice with DIAN. Returns the raw response: the caller decides. */
  validateBill(
    credentials: FactusCredentials,
    payload: Record<string, unknown>,
  ): Promise<FactusResponse> {
    return this.request(credentials, 'POST', '/v2/bills/validate', payload);
  }

  async downloadPdf(
    credentials: FactusCredentials,
    number: string,
  ): Promise<{ fileName: string; pdf: Buffer }> {
    const response = await this.request(
      credentials,
      'GET',
      `/v2/bills/${encodeURIComponent(number)}/download-pdf`,
    );
    if (response.status !== 200) throw this.failure(response);
    const data = response.body?.data ?? {};
    const encoded = data.pdf_base_64_encoded;
    if (typeof encoded !== 'string') throw this.failure(response);
    return {
      fileName: text(data.file_name) || number,
      pdf: Buffer.from(encoded, 'base64'),
    };
  }

  /** The provider's validation errors as one readable line. */
  static errorsOf(response: FactusResponse): string {
    const data = response.body?.data as
      { errors?: Record<string, unknown> } | undefined;
    const errors =
      data?.errors ??
      (response.body as { errors?: Record<string, unknown> } | null)?.errors;
    const parts = errors
      ? Object.entries(errors).flatMap(([field, value]) =>
          (Array.isArray(value) ? value : [value]).map(
            (message) => `${field}: ${String(message)}`,
          ),
        )
      : [];
    return parts.length > 0
      ? parts.join(' · ')
      : (response.body?.message ?? `HTTP ${response.status}`);
  }

  private failure(response: FactusResponse): BusinessRuleException {
    return new BusinessRuleException(
      `El proveedor de facturación respondió con un error: ${FactusClient.errorsOf(response)}`,
      'EINVOICE_PROVIDER_ERROR',
    );
  }

  private async request(
    credentials: FactusCredentials,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    retried = false,
  ): Promise<FactusResponse> {
    const token = await this.token(credentials);
    const response = await this.fetch(
      BASE_URLS[credentials.environment] + path,
      {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    if (response.status === 401 && !retried) {
      this.tokens.delete(this.cacheKey(credentials));
      return this.request(credentials, method, path, body, true);
    }
    return response;
  }

  private async token(credentials: FactusCredentials): Promise<string> {
    const key = this.cacheKey(credentials);
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.token;

    const form = new URLSearchParams({
      grant_type: 'password',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      username: credentials.username,
      password: credentials.password,
    });
    const response = await this.fetch(
      `${BASE_URLS[credentials.environment]}/oauth/token`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
    );
    const body = response.body as {
      access_token?: string;
      expires_in?: number;
    } | null;
    if (response.status !== 200 || !body?.access_token) {
      throw new BusinessRuleException(
        'No se pudo iniciar sesión en el proveedor de facturación: revisa las credenciales configuradas.',
        'EINVOICE_PROVIDER_AUTH_FAILED',
      );
    }
    // Renew a minute early so a request never goes out with a token about to die.
    const lifetime = Math.max(60, Number(body.expires_in ?? 600) - 60);
    this.tokens.set(key, {
      token: body.access_token,
      expiresAt: Date.now() + lifetime * 1000,
    });
    return body.access_token;
  }

  private cacheKey(credentials: FactusCredentials): string {
    return `${credentials.environment}|${credentials.clientId}|${credentials.username}|${credentials.password.length}`;
  }

  private async fetch(url: string, init: RequestInit): Promise<FactusResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const text = await response.text();
      let body: FactusResponse['body'] = null;
      try {
        body = text ? (JSON.parse(text) as FactusResponse['body']) : null;
      } catch {
        body = { message: text.slice(0, 300) };
      }
      return { status: response.status, body };
    } catch (error) {
      this.logger.warn(`Factus request failed: ${(error as Error).message}`);
      throw new BusinessRuleException(
        'El proveedor de facturación no respondió. Intenta de nuevo en unos minutos.',
        'EINVOICE_PROVIDER_UNAVAILABLE',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
