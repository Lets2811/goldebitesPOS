import { redeemLink } from './link';

/**
 * The first conversation with someone whose app is not linked yet: TURA asks
 * for the link code they generated in the POS. It is a fixed script read
 * with a regular expression, on purpose. There is only one thing to
 * understand, so no model is called (and nothing is spent) until the app is
 * linked, and the same script serves the chat and the voice screen.
 *
 * TURA does not ask who it is talking to: the code belongs to the POS user
 * who generated it, and that is who TURA is linked to.
 */

const DIGIT_WORDS: Record<string, string> = {
  cero: '0',
  uno: '1',
  dos: '2',
  tres: '3',
  cuatro: '4',
  cinco: '5',
  seis: '6',
  siete: '7',
  ocho: '8',
  nueve: '9',
};

const CODE_LENGTH = 6;

/**
 * The link code in what was typed or heard. Speech recognition writes digits
 * in many ways ("123456", "12 34 56", "uno dos tres…"), so every digit and
 * every digit word is collected in order and the rest is ignored.
 */
export function parseCode(text: string): string | null {
  const digits = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^a-z0-9]+/)
    .map((token) => DIGIT_WORDS[token] ?? token.replace(/\D/g, ''))
    .join('');
  return digits.length === CODE_LENGTH ? digits : null;
}

const WHERE_TO_GET_IT =
  'Lo generas en el POS, en Configuración, en la sección Tura, y te vincula a tu usuario.';

/** What TURA says to open the conversation while the app is not linked. */
export function onboardingOpening(): string {
  return `¡Hola! Yo soy Tura, tu asistente. Para empezar necesito tu código de vinculación. ${WHERE_TO_GET_IT} ¿Cuáles son los seis dígitos?`;
}

/** TURA's reply to what the person said. Once the code is accepted the app is linked. */
export async function onboardingReply(text: string): Promise<string> {
  const code = parseCode(text);
  if (!code) {
    return `Todavía no estamos vinculados, así que necesito los seis dígitos de tu código. ${WHERE_TO_GET_IT}`;
  }
  try {
    const link = await redeemLink(code);
    return `¡Listo, ${link.userName}! Ya estoy conectado con ${link.businessName}. ¿En qué te ayudo?`;
  } catch (error) {
    return error instanceof Error ? error.message : 'No pude vincularme. Intenta de nuevo.';
  }
}
