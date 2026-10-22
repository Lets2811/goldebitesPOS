import { AxiosError } from 'axios';

/** Normalized error body matching GB-BE's GlobalExceptionFilter output. */
export interface ApiError {
  statusCode: number;
  message: string;
  code?: string;
  details?: unknown;
  path?: string;
}

interface BackendErrorBody {
  statusCode?: number;
  message?: string;
  code?: string;
  details?: unknown;
  path?: string;
}

/** Fallback used only when the backend didn't send a message for that status. */
const FRIENDLY_MESSAGES: Record<number, string> = {
  401: 'Tu sesión expiró. Inicia sesión nuevamente.',
  403: 'No tienes permisos para realizar esta acción.',
  404: 'El recurso solicitado no fue encontrado.',
  409: 'La operación entra en conflicto con la información existente.',
  500: 'Ocurrió un error inesperado en el servidor.',
};

/**
 * GB-BE's DomainException/HttpException messages are hardcoded in English.
 * Known ones get a Spanish translation; anything else passes through as-is
 * rather than being silently swallowed.
 */
const KNOWN_MESSAGE_TRANSLATIONS: Record<string, string> = {
  'Invalid email or password': 'Correo o contraseña incorrectos.',
  'Your account is not active. Contact your administrator.':
    'Tu cuenta no está activa. Contacta a tu administrador.',
  'Invalid or expired refresh token': 'Tu sesión expiró. Inicia sesión nuevamente.',
  'Current password is incorrect': 'La contraseña actual es incorrecta.',
  'This submission is already being processed — try again shortly':
    'Ya estamos procesando tu pedido — intenta de nuevo en un momento.',
};

function translateBackendMessage(message: string): string {
  return KNOWN_MESSAGE_TRANSLATIONS[message] ?? message;
}

/** True when the request never reached the server (offline, DNS, connection refused). */
export function isNetworkError(error: unknown): boolean {
  return error instanceof AxiosError && !error.response && error.code !== 'ECONNABORTED';
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof AxiosError && error.code === 'ECONNABORTED';
}

/** Converts any error thrown by the API client into a consistent ApiError. */
export function normalizeApiError(error: unknown): ApiError {
  if (isTimeoutError(error)) {
    return {
      statusCode: 0,
      code: 'TIMEOUT',
      message: 'La solicitud tardó demasiado. Intenta de nuevo.',
    };
  }

  if (isNetworkError(error)) {
    return {
      statusCode: 0,
      code: 'NETWORK_ERROR',
      message: 'No fue posible conectar con el servidor. Verifica tu conexión.',
    };
  }

  if (error instanceof AxiosError && error.response) {
    const body = error.response.data as BackendErrorBody | undefined;
    const statusCode = body?.statusCode ?? error.response.status;
    const rawMessage =
      body?.message ?? FRIENDLY_MESSAGES[statusCode] ?? 'Ocurrió un error inesperado.';
    return {
      statusCode,
      code: body?.code,
      message: translateBackendMessage(rawMessage),
      details: body?.details,
      path: body?.path,
    };
  }

  return {
    statusCode: 0,
    code: 'UNKNOWN_ERROR',
    message: 'Ocurrió un error inesperado.',
  };
}
