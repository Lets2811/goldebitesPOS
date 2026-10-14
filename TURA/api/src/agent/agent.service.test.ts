import type Anthropic from '@anthropic-ai/sdk';
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { newAudit, type TurnAudit } from '../audit/audit-log.js';
import type { Session } from '../auth.js';
import { config } from '../config.js';
import { makeSession, mockPos, scriptedModel, type ScriptedResponse } from '../testing/fixtures.js';
import { newMeter, type TurnMeter } from '../usage/usage-log.js';
import {
  LIMIT_REACHED_MESSAGE,
  recentHistory,
  runTurn,
  TuraDeclinedError,
  TuraTruncatedError,
  type ChatTurn,
  type TuraEvent,
} from './agent.service.js';

const POS_PRODUCTS = {
  success: true,
  data: {
    items: [
      {
        name: 'Agua manantial',
        description: null,
        sku: null,
        salePrice: 6000,
        isActive: true,
        isVisible: true,
        inventory: { controlled: true, mode: 'DIRECT', unit: 'botella', quantityPerUnit: 1, currentStock: 9 },
      },
    ],
    count: 1,
    total: 1,
  },
};

const callProducts = (id: string, input: unknown = { buscar: 'agua manantial' }): ScriptedResponse => ({
  content: [{ type: 'tool_use', id, name: 'consultar_productos', input }],
  stop_reason: 'tool_use',
});

const say = (text: string): ScriptedResponse => ({
  content: [{ type: 'text', text }],
  stop_reason: 'end_turn',
});

interface Outcome {
  events: TuraEvent[];
  text: string;
  meter: TurnMeter;
  audit: TurnAudit;
  requests: Anthropic.MessageStreamParams[];
}

/** Runs one turn against a scripted model and collects everything it produced. */
async function ask(
  responses: ScriptedResponse[],
  history: ChatTurn[] = [{ role: 'user', content: '¿Cuánta agua manantial queda?' }],
  session: Session = makeSession(),
): Promise<Outcome> {
  const { client, requests } = scriptedModel(responses);
  const events: TuraEvent[] = [];
  const meter = newMeter();
  const audit = newAudit();
  try {
    await runTurn({
      session,
      history,
      mode: 'chat',
      meter,
      audit,
      emit: (event) => events.push(event),
      isCancelled: () => false,
      model: client,
    });
  } catch (error) {
    // What was collected up to the failure is part of what the tests check.
    throw Object.assign(error as Error, { outcome: { events, meter, audit, requests } });
  }
  const text = events.map((event) => (event.type === 'text' ? event.delta : '')).join('');
  return { events, text, meter, audit, requests };
}

/** The tool results the model was sent in a request, taken from its last message. */
function toolResults(request: Anthropic.MessageStreamParams): Anthropic.ToolResultBlockParam[] {
  const last = request.messages.at(-1);
  assert.ok(last && last.role === 'user' && Array.isArray(last.content));
  return last.content as Anthropic.ToolResultBlockParam[];
}

describe('runTurn', () => {
  afterEach(() => mock.restoreAll());

  it('runs the whole loop: the model calls the tool, gets the POS data, and answers with it', async () => {
    const pos = mockPos(() => ({ body: POS_PRODUCTS }));

    const { events, text, requests, meter, audit } = await ask([
      callProducts('call-1'),
      say('Quedan 9 botellas de Agua manantial.'),
    ]);

    assert.deepEqual(events, [
      { type: 'tool', name: 'consultar_productos' },
      { type: 'text', delta: 'Quedan 9 botellas de Agua manantial.' },
      { type: 'done' },
    ]);
    assert.equal(text, 'Quedan 9 botellas de Agua manantial.');

    // The POS was asked once, as the user.
    assert.equal(pos.length, 1);
    assert.equal(pos[0].url.searchParams.get('search'), 'agua manantial');
    assert.equal(pos[0].authorization, 'Bearer user-access-token');

    // The second request carries the model's own call followed by its result.
    assert.equal(requests.length, 2);
    assert.deepEqual(
      requests[1].messages.map((message) => message.role),
      ['user', 'assistant', 'user'],
    );
    const [result] = toolResults(requests[1]);
    assert.equal(result.type, 'tool_result');
    assert.equal(result.tool_use_id, 'call-1');
    assert.equal(result.is_error, undefined);
    assert.equal(JSON.parse(result.content as string).productos[0].existencias, 9);

    assert.deepEqual(meter.tools, ['consultar_productos']);
    assert.equal(meter.calls.length, 2);
    assert.equal(audit.iterations, 2);
    assert.equal(audit.limitReached, false);
    assert.equal(audit.tools.length, 1);
    assert.deepEqual(audit.tools[0].input, { buscar: 'agua manantial' });
    assert.equal(audit.tools[0].ok, true);
    assert.match(audit.tools[0].result ?? '', /Agua manantial/);
  });

  it('answers without tools when the model needs none', async () => {
    const pos = mockPos(() => ({ body: POS_PRODUCTS }));

    const { text, requests, audit } = await ask([say('¡Hola, Ana!')], [{ role: 'user', content: 'hola' }]);

    assert.equal(text, '¡Hola, Ana!');
    assert.equal(requests.length, 1);
    assert.equal(pos.length, 0);
    assert.deepEqual(audit.tools, []);
  });

  it('hands a POS failure to the model as an error result, and the turn goes on', async () => {
    mockPos(() => ({
      status: 403,
      body: { message: 'This action requires the following permission(s): products.read' },
    }));

    const { text, events, requests, audit } = await ask([
      callProducts('call-1'),
      say('Tu usuario no tiene acceso a los productos; pídeselo a un administrador.'),
    ]);

    const [result] = toolResults(requests[1]);
    assert.equal(result.is_error, true);
    assert.match(result.content as string, /403/);
    assert.match(result.content as string, /products\.read/);

    assert.match(text, /no tiene acceso/);
    assert.deepEqual(events.at(-1), { type: 'done' });
    assert.equal(audit.tools[0].ok, false);
    assert.match(audit.tools[0].error ?? '', /403/);
  });

  it('reports a POS that is down the same way, instead of failing the turn', async () => {
    mockPos(() => new TypeError('fetch failed'));

    const { requests, events } = await ask([callProducts('call-1'), say('No pude consultar el POS.')]);

    const [result] = toolResults(requests[1]);
    assert.equal(result.is_error, true);
    assert.match(result.content as string, /503/);
    assert.deepEqual(events.at(-1), { type: 'done' });
  });

  it('rejects invalid parameters without calling the POS, and tells the model why', async () => {
    const pos = mockPos(() => ({ body: POS_PRODUCTS }));

    const { requests, audit } = await ask([callProducts('call-1', { limite: 500 }), say('Corrijo.')]);

    assert.equal(pos.length, 0);
    const [result] = toolResults(requests[1]);
    assert.equal(result.is_error, true);
    assert.match(result.content as string, /Parámetros inválidos: limite/);
    assert.deepEqual(audit.tools[0].input, { limite: 500 });
    assert.equal(audit.tools[0].ok, false);
  });

  it('refuses a tool the user was not offered', async () => {
    const pos = mockPos(() => ({ body: POS_PRODUCTS }));

    const { requests } = await ask(
      [callProducts('call-1'), say('No tengo esa herramienta.')],
      undefined,
      makeSession({ permissions: [] }),
    );

    assert.deepEqual(requests[0].tools, []);
    assert.equal(pos.length, 0);
    assert.equal(toolResults(requests[1])[0].is_error, true);
  });

  it('returns the results of several calls in one message, in order', async () => {
    mockPos(() => ({ body: POS_PRODUCTS }));

    const { requests, audit } = await ask([
      {
        content: [
          { type: 'tool_use', id: 'call-1', name: 'consultar_productos', input: { buscar: 'agua' } },
          { type: 'tool_use', id: 'call-2', name: 'consultar_productos', input: { buscar: 'gaseosa' } },
        ],
        stop_reason: 'tool_use',
      },
      say('Listo.'),
    ]);

    assert.deepEqual(
      toolResults(requests[1]).map((result) => result.tool_use_id),
      ['call-1', 'call-2'],
    );
    assert.equal(audit.tools.length, 2);
  });

  it('stops at the iteration limit with a clear message instead of looping', async () => {
    const pos = mockPos(() => ({ body: POS_PRODUCTS }));

    // A model that never stops asking for the tool.
    const { requests, text, events, audit } = await ask([callProducts('call-n')]);

    assert.equal(config.maxToolIterations, 6);
    assert.equal(requests.length, 6);
    // The last round's calls are not run: nothing would read their results.
    assert.equal(pos.length, 5);
    assert.equal(text, LIMIT_REACHED_MESSAGE);
    assert.deepEqual(events.at(-1), { type: 'done' });
    assert.equal(audit.iterations, 6);
    assert.equal(audit.limitReached, true);
  });

  it('fails the turn when the model declines, without running anything', async () => {
    const pos = mockPos(() => ({ body: POS_PRODUCTS }));

    await assert.rejects(ask([{ content: [], stop_reason: 'refusal' }]), TuraDeclinedError);
    assert.equal(pos.length, 0);
  });

  it('never runs a tool call that was cut off at the response ceiling', async () => {
    const pos = mockPos(() => ({ body: POS_PRODUCTS }));

    await assert.rejects(
      ask([{ ...callProducts('call-1'), stop_reason: 'max_tokens' }]),
      TuraTruncatedError,
    );
    assert.equal(pos.length, 0);
  });

  it('keeps an answer that was cut short, since the user already saw it', async () => {
    const { text, events } = await ask([
      { content: [{ type: 'text', text: 'Quedan 9 botellas y' }], stop_reason: 'max_tokens' },
    ]);

    assert.equal(text, 'Quedan 9 botellas y');
    assert.deepEqual(events.at(-1), { type: 'done' });
  });

  it('stops asking the model once nobody is listening', async () => {
    const { client, requests } = scriptedModel([say('Hola'), say('no debería llegar')]);
    const events: TuraEvent[] = [];

    await runTurn({
      session: makeSession(),
      history: [{ role: 'user', content: 'hola' }],
      mode: 'chat',
      meter: newMeter(),
      audit: newAudit(),
      emit: (event) => events.push(event),
      isCancelled: () => true,
      model: client,
    });

    assert.equal(requests.length, 1);
    assert.deepEqual(events, []);
  });
});

describe('what the model is sent', () => {
  afterEach(() => mock.restoreAll());

  it('uses the configured model, ceiling and effort, with the tool definitions', async () => {
    const { requests } = await ask([say('Hola')]);
    const [request] = requests;

    assert.equal(request.model, config.model);
    assert.equal(request.max_tokens, config.maxTokens);
    assert.deepEqual(request.output_config, { effort: config.effort });
    assert.deepEqual(
      request.tools?.map((tool) => ('name' in tool ? tool.name : null)),
      ['consultar_productos'],
    );
  });

  it('caches the rules and tools, and keeps who and when out of the cached part', async () => {
    const { requests } = await ask([say('Hola')]);
    const system = requests[0].system as Anthropic.TextBlockParam[];

    assert.equal(system.length, 2);
    assert.deepEqual(system[0].cache_control, { type: 'ephemeral' });
    assert.equal(system[1].cache_control, undefined);

    // The cached block is identical for any user at any time.
    assert.doesNotMatch(system[0].text, /Ana|OWNER|Golden Bites|\d{4}/);
    assert.match(system[0].text, /nunca inventes cifras/);
    assert.match(system[0].text, /COP/);
    assert.match(system[0].text, /español/);

    assert.match(system[1].text, /Ana/);
    assert.match(system[1].text, /OWNER/);
    assert.match(system[1].text, /Golden Bites/);
    assert.match(system[1].text, /America\/Bogota/);
    assert.match(system[1].text, /\d{1,2}:\d{2}/);
    assert.match(system[1].text, /sede/);
  });

  it('gives two users the same cached prefix', async () => {
    const first = await ask([say('Hola')]);
    const second = await ask(
      [say('Hola')],
      [{ role: 'user', content: 'otra pregunta' }],
      makeSession({ firstName: 'Luis', roleName: 'CASHIER', branchId: null }),
    );

    assert.deepEqual(first.requests[0].tools, second.requests[0].tools);
    assert.deepEqual(
      (first.requests[0].system as Anthropic.TextBlockParam[])[0],
      (second.requests[0].system as Anthropic.TextBlockParam[])[0],
    );
  });

  it('sends only the last 10 turns of a long conversation', async () => {
    const history: ChatTurn[] = [];
    for (let turn = 1; turn <= 14; turn++) {
      history.push({ role: 'user', content: `pregunta ${turn}` });
      if (turn < 14) {
        history.push({ role: 'assistant', content: `respuesta ${turn}` });
      }
    }

    const { requests } = await ask([say('Hola')], history);
    const sent = requests[0].messages;

    assert.equal(sent.filter((message) => message.role === 'user').length, 10);
    assert.equal(sent[0].content, 'pregunta 5');
    assert.equal(sent.at(-1)?.content, 'pregunta 14');
  });
});

describe('recentHistory', () => {
  const turn = (role: ChatTurn['role'], content: string): ChatTurn => ({ role, content });

  it('keeps a short conversation whole', () => {
    const history = [turn('user', 'a'), turn('assistant', 'b'), turn('user', 'c')];
    assert.deepEqual(recentHistory(history, 10), history);
  });

  it('always starts on a message from the user', () => {
    const history = [turn('assistant', 'saludo'), turn('user', 'a'), turn('assistant', 'b'), turn('user', 'c')];
    assert.deepEqual(recentHistory(history, 10), history.slice(1));
    assert.deepEqual(recentHistory(history, 1), [turn('user', 'c')]);
  });
});

describe('sales questions', () => {
  afterEach(() => mock.restoreAll());

  const analyst = makeSession({ permissions: ['analytics.read'] });
  const salesAnswer = (total: number) => ({
    body: {
      success: true,
      data: {
        period: { from: '2026-10-05', to: '2026-10-11' },
        scope: { branch: null },
        summary: { totalSales: total, orderCount: 10, averageTicket: total / 10 },
      },
    },
  });

  it('compares two periods with two calls to the same endpoint, and no special comparison endpoint', async () => {
    const pos = mockPos(({ url }) =>
      salesAnswer(url.searchParams.get('dateFrom') === '2026-10-12' ? 900000 : 1500000),
    );

    const { requests, text } = await ask(
      [
        {
          content: [
            {
              type: 'tool_use',
              id: 'this-week',
              name: 'consultar_ventas',
              input: { desde: '2026-10-12', hasta: '2026-10-13' },
            },
            {
              type: 'tool_use',
              id: 'last-week',
              name: 'consultar_ventas',
              input: { desde: '2026-10-05', hasta: '2026-10-11' },
            },
          ],
          stop_reason: 'tool_use',
        },
        say('Esta semana van 900.000 pesos; la pasada cerró en 1.500.000.'),
      ],
      [{ role: 'user', content: 'Compara esta semana con la semana pasada' }],
      analyst,
    );

    assert.deepEqual(
      pos.map(({ url }) => [url.pathname, url.searchParams.get('dateFrom'), url.searchParams.get('dateTo')]),
      [
        ['/api/v1/assistant/sales', '2026-10-12', '2026-10-13'],
        ['/api/v1/assistant/sales', '2026-10-05', '2026-10-11'],
      ],
    );
    const results = toolResults(requests[1]);
    assert.deepEqual(
      results.map((result) => JSON.parse(result.content as string).resumen.total_vendido),
      [900000, 1500000],
    );
    assert.match(text, /900\.000/);
  });

  it("returns the tool's own refusal to the model in its words, and the turn goes on", async () => {
    const pos = mockPos(() => salesAnswer(0));

    const { requests, events, audit } = await ask(
      [
        {
          content: [
            {
              type: 'tool_use',
              id: 'call-1',
              name: 'consultar_ventas',
              input: { desde: '2024-01-01', hasta: '2026-10-13' },
            },
          ],
          stop_reason: 'tool_use',
        },
        say('Solo puedo consultar hasta un año a la vez.'),
      ],
      [{ role: 'user', content: '¿Cuánto hemos vendido desde 2024?' }],
      analyst,
    );

    assert.equal(pos.length, 0);
    const [result] = toolResults(requests[1]);
    assert.equal(result.is_error, true);
    assert.match(result.content as string, /máximo es 366/);
    assert.deepEqual(events.at(-1), { type: 'done' });
    assert.equal(audit.tools[0].ok, false);
  });

  it('is not offered to a user without analytics.read', async () => {
    const { requests } = await ask([say('No tengo acceso a ventas.')], undefined, makeSession());

    assert.deepEqual(
      requests[0].tools?.map((tool) => ('name' in tool ? tool.name : null)),
      ['consultar_productos'],
    );
  });
});
