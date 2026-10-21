import { Controller, Get, HttpException, HttpStatus, Logger, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AdminConfig } from '../config';

const TIMEOUT_MS = 15_000;

/**
 * What TURA (the assistant) costs to run and which tools it has, for the
 * Golden Bites team. TURA keeps both behind its own admin key; this service
 * holds that key and asks for them, so the team sees them from their Admin
 * session and the key never reaches a browser.
 */
@Controller('tura')
export class TuraController {
  private readonly logger = new Logger(TuraController.name);

  constructor(private readonly configService: ConfigService) {}

  @Get('usage')
  usage(@Query('days') days?: string) {
    const period = Math.min(365, Math.max(1, parseInt(days ?? '30', 10) || 30));
    return this.fromTura(`/tura/admin/usage?days=${period}`);
  }

  @Get('tools')
  tools() {
    return this.fromTura('/tura/admin/tools');
  }

  private async fromTura(path: string): Promise<unknown> {
    const { url, adminKey } = this.configService.getOrThrow<AdminConfig>('admin').tura;
    if (!url || !adminKey) {
      throw new HttpException(
        { code: 'TURA_NOT_CONNECTED', message: 'TURA no está conectado a este Admin (TURA_API_URL y TURA_ADMIN_KEY).' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    let response: globalThis.Response;
    try {
      response = await fetch(`${url}${path}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(`TURA unreachable for ${path}`, error instanceof Error ? error.message : String(error));
      throw new HttpException(
        { code: 'TURA_UNAVAILABLE', message: 'No se pudo conectar con TURA.' },
        HttpStatus.BAD_GATEWAY,
      );
    }
    if (!response.ok) {
      this.logger.error(`TURA answered ${response.status} for ${path}`);
      throw new HttpException(
        {
          code: response.status === 401 ? 'TURA_KEY_REJECTED' : 'TURA_ERROR',
          message:
            response.status === 401
              ? 'TURA rechazó la clave de administración: revisa TURA_ADMIN_KEY.'
              : 'TURA no pudo responder.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
    return response.json();
  }
}
