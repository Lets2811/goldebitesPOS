import type { Session } from '../auth.js';
import type { ChatTurn, TuraEvent } from './run-turn.js';

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
    matches: /venta|vend|factur/i,
    tool: 'consultar_ventas',
    reply: () =>
      'Dato de prueba: esta semana van 4.850.000 pesos en 132 pedidos. Lo más vendido fue la hamburguesa clásica, con 48 unidades.',
  },
  {
    matches: /pedido|orden|mesa/i,
    tool: 'listar_pedidos',
    reply: () =>
      'Dato de prueba: hay 3 pedidos pendientes. Dos son en mesa y uno es para llevar; el más antiguo lleva 12 minutos en preparación.',
  },
  {
    matches: /stock|inventario|insumo|bajo/i,
    tool: 'consultar_stock_bajo',
    reply: () =>
      'Dato de prueba: hay 2 insumos por debajo del mínimo. Quedan 3 kilos de queso y 10 panes de hamburguesa.',
  },
  {
    matches: /d[ií]a|resumen|c[oó]mo va|caja/i,
    tool: 'resumen_del_dia',
    reply: () =>
      'Dato de prueba: hoy van 18 pedidos por 640.000 pesos, con un ticket promedio de 35.500. Hay 3 pedidos activos y la caja está abierta.',
  },
  {
    matches: /hola|buen[oa]s|qu[eé] tal|c[oó]mo est[aá]s/i,
    reply: (session) =>
      `¡Hola${session.firstName ? `, ${session.firstName}` : ''}! Estoy muy bien, gracias. Estoy en modo de prueba, sin inteligencia artificial. Pregúntame por ventas, pedidos o inventario y te respondo con datos de ejemplo.`,
  },
];

const FALLBACK: Script = {
  matches: /./,
  reply: () =>
    'Estoy en modo de prueba, así que no consulté nada de verdad. Pregúntame por ventas, pedidos, inventario o cómo va el día para ver una respuesta de ejemplo.',
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
