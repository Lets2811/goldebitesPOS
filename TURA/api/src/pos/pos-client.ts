import { config } from '../config.js';

type QueryValue = string | number | boolean | undefined;

/** Standard success envelope returned by every GB-BE endpoint (see ResponseInterceptor). */
interface PosEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface PosResult<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export class PosApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PosApiError';
  }
}

/**
 * Client for GB-BE, bound to one user's access token. Every call carries that
 * token, so GB-BE's own guards decide what TURA may see or change — this
 * service holds no credentials of its own for the POS. Writes go only through
 * a write tool's `commit`, which runs once the user has confirmed it.
 */
export class PosClient {
  constructor(private readonly accessToken: string) {}

  get<T>(path: string, query: Record<string, QueryValue> = {}): Promise<PosResult<T>> {
    return this.request<T>('GET', path, query);
  }

  post<T>(path: string, body: unknown): Promise<PosResult<T>> {
    return this.request<T>('POST', path, {}, body);
  }

  patch<T>(path: string, body: unknown): Promise<PosResult<T>> {
    return this.request<T>('PATCH', path, {}, body);
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    query: Record<string, QueryValue>,
    body?: unknown,
  ): Promise<PosResult<T>> {
    const url = new URL(`${config.posApiUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(config.posTimeoutMs),
      });
    } catch (error) {
      throw new PosApiError(
        error instanceof Error && error.name === 'TimeoutError' ? 504 : 503,
        error instanceof Error && error.name === 'TimeoutError'
          ? 'El POS tardó demasiado en responder'
          : 'No se pudo conectar con el POS',
      );
    }

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'message' in payload
          ? String(payload.message)
          : response.statusText;
      throw new PosApiError(response.status, message);
    }

    const envelope = payload as PosEnvelope<T>;
    return { data: envelope.data, meta: envelope.meta };
  }
}
