/** Tokens one model request was billed for, as the API reports them. */
export interface TokenCount {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

interface ModelPrice {
  /** Model id, matched as a prefix so dated ids ("…-20251001") resolve too. */
  model: string;
  /** US dollars per million tokens. */
  input: number;
  output: number;
  /** Per million tokens read from the prompt cache; a tenth of `input` unless stated. */
  cacheRead?: number;
}

/**
 * Anthropic's list prices as of October 2026. They are not available from
 * the API, so they have to be kept up to date by hand; costs are computed from
 * the stored token counts when they are read, so a correction here also
 * corrects past turns.
 */
const PRICES: ModelPrice[] = [
  { model: 'claude-fable-5', input: 10, output: 50 },
  { model: 'claude-opus-5-5', input: 4, output: 20, cacheRead: 0.2 },
  { model: 'claude-opus-5', input: 5, output: 25 },
  { model: 'claude-opus-4', input: 5, output: 25 },
  { model: 'claude-sonnet-5', input: 2, output: 10 },
  { model: 'claude-sonnet-4', input: 3, output: 15 },
  // Prompts up to 100K tokens, which is every one TURA sends; longer ones cost five times this.
  { model: 'claude-haiku-5-5', input: 0.1, output: 0.5 },
  { model: 'claude-haiku-4-5', input: 1, output: 5 },
];

/** Writing to the prompt cache costs this much more than plain input. */
const CACHE_WRITE_FACTOR = 1.25;

/** The models an answer could reasonably be moved to, for the comparison. */
export const COMPARABLE_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];

function priceOf(model: string): ModelPrice | undefined {
  return PRICES.find((price) => model.startsWith(price.model));
}

/** Cost in US dollars, or null when the model is not in the price list. */
export function costOf(model: string, tokens: TokenCount): number | null {
  const price = priceOf(model);
  if (!price) {
    return null;
  }
  return (
    (tokens.input * price.input +
      tokens.output * price.output +
      tokens.cacheRead * (price.cacheRead ?? price.input / 10) +
      tokens.cacheWrite * price.input * CACHE_WRITE_FACTOR) /
    1_000_000
  );
}

export function listPrice(model: string): { input: number; output: number } | null {
  const price = priceOf(model);
  return price ? { input: price.input, output: price.output } : null;
}
