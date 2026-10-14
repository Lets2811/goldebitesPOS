import { Transform } from 'class-transformer';

/**
 * Reads a boolean query flag as it was sent. The pipe's implicit conversion
 * would turn the string "false" into true (any non-empty string is truthy),
 * so the raw value is taken from the query itself.
 */
export const QueryBoolean = () =>
  Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const raw = obj[key];
    if (raw === 'true' || raw === true) return true;
    if (raw === 'false' || raw === false) return false;
    return raw;
  });
