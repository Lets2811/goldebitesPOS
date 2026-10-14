import type { Session } from '../auth.js';
import type { ChatTurn, TuraEvent } from './agent.service.js';

/**
 * Stands in for the model while the interface is being worked on
 * (TURA_SIMULATE_AI): same events, same pacing, no request to Claude and no
 * cost. It does not read the POS either, so every figure it gives is made up
 * and says so.
 */

interface Script {
  matches: RegExp;
  /** The POS tool the real assistant would call, to exercise that part of the interface. */
  tool?: string;
  reply: (session: Session) => string;
}

const SCRIPTS: Script[] = [
  {
    matches: /producto|precio|cu[aá]nto (cuesta|vale)|existencia|stock|queda|agua|gaseosa/i,
    tool: 'consultar_productos',
    reply: () =>
      'Dato de prueba: encontré Agua manantial, a 6.000 pesos. Está activa en el menú y quedan 9 botellas.',
  },
  {
    matches: /venta|vend|factur|ticket/i,
    tool: 'consultar_ventas',
    reply: () =>
      'Dato de prueba: esta semana van 4.850.000 pesos en 132 ventas, con un ticket promedio de 36.700. Lo más vendido fue la hamburguesa clásica, con 48 unidades.',
  },
  {
    matches: /hola|buen[oa]s|qu[eé] tal|c[oó]mo est[aá]s/i,
    reply: (session) =>
      `¡Hola${session.firstName ? `, ${session.firstName}` : ''}! Estoy muy bien, gracias. Estoy en modo de prueba, sin inteligencia artificial. Pregúntame por un producto o por las ventas y te respondo con datos de ejemplo.`,
  },
];

const FALLBACK: Script = {
  matches: /./,
  reply: () =>
    'Estoy en modo de prueba, así que no consulté nada de verdad. Pregúntame por un producto o por las ventas para ver una respuesta de ejemplo.',
};

const THINKING_MS = 1200;
const TOOL_MS = 1000;
const WORD_MS = 45;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Same contract as runTurn, minus the usage meter: there is nothing to bill. */
export async function runSimulatedTurn(
  session: Session,
  history: ChatTurn[],
  emit: (event: TuraEvent) => void,
  isCancelled: () => boolean,
): Promise<void> {
  const question = history.at(-1)?.content ?? '';
  const script = SCRIPTS.find(({ matches }) => matches.test(question)) ?? FALLBACK;

  await pause(THINKING_MS);
  if (script.tool && !isCancelled()) {
    emit({ type: 'tool', name: script.tool });
    await pause(TOOL_MS);
  }

  // Word by word, like the stream of a real answer.
  for (const word of script.reply(session).split(' ')) {
    if (isCancelled()) {
      return;
    }
    emit({ type: 'text', delta: `${word} ` });
    await pause(WORD_MS);
  }
  emit({ type: 'done' });
}
