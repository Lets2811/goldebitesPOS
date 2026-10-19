import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';

/**
 * Same envelope as the POS's API ({ success, data } / { success: false, code,
 * message }), so the Admin app reads both the same way: answers relayed from
 * the POS already come in it.
 */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data: unknown) => (data === undefined ? undefined : { success: true, data })));
  }
}

const CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
};

@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Ocurrió un error inesperado';
    let code = CODES[status] ?? 'INTERNAL_ERROR';
    if (error instanceof HttpException) {
      const body = error.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const value = body as { message?: string | string[]; code?: string };
        message = Array.isArray(value.message) ? value.message.join('. ') : (value.message ?? message);
        code = value.code ?? code;
      }
    } else {
      this.logger.error('Unhandled error', error instanceof Error ? error.stack : String(error));
    }
    response.status(status).json({ success: false, statusCode: status, code, message });
  }
}
