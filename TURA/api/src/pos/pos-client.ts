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
 * Read-only client for GB-BE, bound to one user's access token. Every call
 * carries that token, so GB-BE's own guards decide what TURA may see — this
 * service holds no credentials of its own for the POS.
 */
export class PosClient {
  constructor(private readonly accessToken: string) {}

  async get<T>(
    path: string,
    query: Record<string, QueryValue> = {},
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
        headers: { Authorization: `Bearer ${this.accessToken}` },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new PosApiError(503, 'No se pudo conectar con el POS');
    }

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        body && typeof body === 'object' && 'message' in body
          ? String(body.message)
          : response.statusText;
      throw new PosApiError(response.status, message);
    }

    const envelope = body as PosEnvelope<T>;
    return { data: envelope.data, meta: envelope.meta };
  }
}
