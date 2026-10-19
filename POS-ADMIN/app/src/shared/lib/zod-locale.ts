import type { z } from 'zod';
import { ZodIssueCode } from 'zod';

/**
 * Global fallback messages for Zod validation issues that don't carry a
 * custom message (e.g. `.max(100)` with no second argument). Schemas that
 * already pass a custom message (`.min(2, 'Ingresa un nombre')`) are
 * unaffected — Zod only consults this map when a check has none of its own.
 * Registered once in main.tsx via `z.setErrorMap(zodEsErrorMap)`.
 */
export const zodEsErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') {
        return { message: 'Este campo es obligatorio' };
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return {
          message: `Debe tener al menos ${issue.minimum} caracteres`,
        };
      }
      if (issue.type === 'number') {
        return {
          message: `Debe ser mayor o igual a ${issue.minimum}`,
        };
      }
      break;
    case ZodIssueCode.too_big:
      if (issue.type === 'string') {
        return {
          message: `Debe tener como máximo ${issue.maximum} caracteres`,
        };
      }
      if (issue.type === 'number') {
        return {
          message: `Debe ser menor o igual a ${issue.maximum}`,
        };
      }
      break;
    case ZodIssueCode.invalid_string:
      if (issue.validation === 'email') {
        return { message: 'Ingresa un correo válido' };
      }
      break;
  }
  return { message: ctx.defaultError };
};
