import { All, Controller, Logger, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CurrentAdmin } from '../auth/auth.decorators';
import type { AdminConfig } from '../config';

const TIMEOUT_MS = 70_000;
/** Methods the bridge relays; nothing else reaches the POS. */
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * The bridge to the POS: what the Admin does to businesses (create them,
 * branches, modules, users' access, Factus, TURA) and to the platform-wide
 * flags is done by GB-BE's internal API, so the POS's rules (roles,
 * permissions, catalogs) live in one place. This service adds who is acting
 * (X-Platform-User-Id, for the POS's audit log) and the internal key, which
 * never leaves the server.
 *
 * Only these path families are relayed; anything else is a 404 here.
 */
@Controller()
export class PosController {
  private readonly logger = new Logger(PosController.name);

  constructor(private readonly configService: ConfigService) {}

  @All(['businesses', 'businesses/*path', 'feature-flags', 'feature-flags/*path'])
  async relay(@Req() req: Request, @Res() res: Response, @CurrentAdmin('id') adminId: string): Promise<void> {
    if (!METHODS.has(req.method)) {
      res.status(405).json({ success: false, statusCode: 405, code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido' });
      return;
    }
    const { posInternalUrl, internalApiKey } = this.configService.getOrThrow<AdminConfig>('admin');
    // The part after this service's prefix: /admin-api/v1/businesses/x → /businesses/x.
    const path = req.originalUrl.replace(/^\/admin-api\/v1/, '');
    const hasBody = !['GET', 'DELETE'].includes(req.method) || (req.body && Object.keys(req.body as object).length > 0);

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(`${posInternalUrl}${path}`, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': internalApiKey,
          'X-Platform-User-Id': adminId,
        },
        body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(`POS unreachable for ${req.method} ${path}`, error instanceof Error ? error.message : String(error));
      res.status(502).json({ success: false, statusCode: 502, code: 'POS_UNAVAILABLE', message: 'No se pudo conectar con el POS' });
      return;
    }

    res.status(upstream.status);
    const type = upstream.headers.get('content-type');
    if (type) res.setHeader('Content-Type', type);
    res.send(Buffer.from(await upstream.arrayBuffer()));
  }
}
