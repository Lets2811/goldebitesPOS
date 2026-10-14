import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { PosApiError } from '../pos/pos-client.js';
import { makeSession, mockPos, type PosRequest } from '../testing/fixtures.js';
import { consultarVentas } from './consultar-ventas.js';
import { toolsFor } from './registry.js';
import { ToolRefusedError } from './types.js';

/** What GET /assistant/sales answers for a single-branch business with everything asked for. */
const POS_ANSWER = {
  success: true,
  data: {
    period: { from: '2026-10-05', to: '2026-10-11', timezone: 'America/Bogota' },
    scope: { branch: null },
    summary: { totalSales: 3250000, orderCount: 248, averageTicket: 13104.84 },
    breakdown: {
      groupBy: 'day',
      items: [
        { from: '2026-10-05', to: '2026-10-05', totalSales: 250000, orderCount: 18 },
        { from: '2026-10-06', to: '2026-10-06', totalSales: 410000, orderCount: 31 },
      ],
    },
    topProducts: {
      orderedBy: 'quantity',
      items: [{ name: 'Combo Nuggets x6', quantitySold: 42, revenue: 504000 }],
    },
  },
};

const session = makeSession({ permissions: ['analytics.read'] });

function run(input: unknown) {
  const parsed = consultarVentas.parse(input);
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
  return consultarVentas.execute(parsed.value, { session });
}

/** The query the tool sent to the POS. */
const sent = (request: PosRequest) => Object.fromEntries(request.url.searchParams);

describe('consultar_ventas', () => {
  beforeEach(() => {
    // Tuesday October 13th 2026, 9 PM in Bogotá — already the 14th in UTC.
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-14T02:00:00.000Z') });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('named periods become concrete days before the POS is asked', () => {
    const cases: [string, string, string][] = [
      ['hoy', '2026-10-13', '2026-10-13'],
      ['ayer', '2026-10-12', '2026-10-12'],
      ['esta_semana', '2026-10-12', '2026-10-13'],
      ['semana_pasada', '2026-10-05', '2026-10-11'],
      ['este_mes', '2026-10-01', '2026-10-13'],
      ['mes_pasado', '2026-09-01', '2026-09-30'],
      ['este_anio', '2026-01-01', '2026-10-13'],
      ['anio_pasado', '2025-01-01', '2025-12-31'],
      ['este_fin_de_semana', '2026-10-10', '2026-10-11'],
    ];

    for (const [periodo, dateFrom, dateTo] of cases) {
      it(`${periodo} → ${dateFrom} to ${dateTo}`, async () => {
        const requests = mockPos(() => ({ body: POS_ANSWER }));

        await run({ periodo });

        assert.equal(requests.length, 1);
        assert.equal(requests[0].url.pathname, '/api/v1/assistant/sales');
        assert.deepEqual(sent(requests[0]), { dateFrom, dateTo });
      });
    }

    it("takes today from the business's clock, not UTC's", async () => {
      const requests = mockPos(() => ({ body: POS_ANSWER }));

      await run({ periodo: 'hoy' });

      // The server's UTC date is already the 14th.
      assert.equal(new Date().toISOString().slice(0, 10), '2026-10-14');
      assert.equal(sent(requests[0]).dateFrom, '2026-10-13');
    });
  });

  describe('explicit ranges go through as given', () => {
    const cases: [string, string, string][] = [
      ['enero de 2026', '2026-01-01', '2026-01-31'],
      ['del 1 al 15 de septiembre', '2026-09-01', '2026-09-15'],
      ['del 15 de septiembre al 5 de octubre', '2026-09-15', '2026-10-05'],
      ['un solo día', '2026-10-09', '2026-10-09'],
      ['un año completo', '2025-01-01', '2025-12-31'],
    ];

    for (const [label, desde, hasta] of cases) {
      it(label, async () => {
        const requests = mockPos(() => ({ body: POS_ANSWER }));

        await run({ desde, hasta });

        assert.deepEqual(sent(requests[0]), { dateFrom: desde, dateTo: hasta });
      });
    }
  });

  it('sends the user token and never a user, business or branch id', async () => {
    const requests = mockPos(() => ({ body: POS_ANSWER }));

    await run({ periodo: 'hoy' });

    assert.equal(requests[0].authorization, 'Bearer user-access-token');
    assert.deepEqual(Object.keys(sent(requests[0])).sort(), ['dateFrom', 'dateTo']);
  });

  it('maps the grouping, the products and a branch named by the user', async () => {
    const requests = mockPos(() => ({ body: POS_ANSWER }));

    await run({
      periodo: 'este_mes',
      agrupar_por: 'dia',
      incluir_productos_mas_vendidos: true,
      orden_productos: 'ingresos',
      limite_productos: 5,
      sede: 'Norte',
    });

    assert.deepEqual(sent(requests[0]), {
      dateFrom: '2026-10-01',
      dateTo: '2026-10-13',
      groupBy: 'day',
      includeTopProducts: 'true',
      topProductsLimit: '5',
      topProductsOrder: 'revenue',
      branch: 'Norte',
    });
  });

  it('maps week and month groupings, and leaves product options out unless products are asked for', async () => {
    const requests = mockPos(() => ({ body: POS_ANSWER }));

    await run({ periodo: 'este_anio', agrupar_por: 'mes', limite_productos: 3, orden_productos: 'cantidad' });
    await run({ periodo: 'este_mes', agrupar_por: 'semana' });

    assert.deepEqual(sent(requests[0]), {
      dateFrom: '2026-01-01',
      dateTo: '2026-10-13',
      groupBy: 'month',
    });
    assert.equal(sent(requests[1]).groupBy, 'week');
  });

  it('returns the figures in the words the model answers with, without internal ids', async () => {
    mockPos(() => ({ body: POS_ANSWER }));

    const result = await run({ periodo: 'semana_pasada', agrupar_por: 'dia', incluir_productos_mas_vendidos: true });

    assert.deepEqual(result, {
      periodo: { desde: '2026-10-05', hasta: '2026-10-11' },
      resumen: { total_vendido: 3250000, numero_ventas: 248, ticket_promedio: 13104.84 },
      detalle: [
        { dia: '2026-10-05', total_vendido: 250000, numero_ventas: 18 },
        { dia: '2026-10-06', total_vendido: 410000, numero_ventas: 31 },
      ],
      productos_mas_vendidos: {
        ordenados_por: 'cantidad',
        productos: [{ nombre: 'Combo Nuggets x6', cantidad_vendida: 42, ingresos: 504000 }],
      },
    });
  });

  it('a period without sales is an answer of zeros, not an error', async () => {
    mockPos(() => ({
      body: {
        success: true,
        data: {
          period: { from: '2026-01-01', to: '2026-01-31' },
          scope: { branch: null },
          summary: { totalSales: 0, orderCount: 0, averageTicket: 0 },
        },
      },
    }));

    const result = await run({ desde: '2026-01-01', hasta: '2026-01-31' });

    assert.deepEqual(result, {
      periodo: { desde: '2026-01-01', hasta: '2026-01-31' },
      resumen: { total_vendido: 0, numero_ventas: 0, ticket_promedio: 0 },
    });
  });

  describe('branches', () => {
    const multiBranch = (branch: string | null) => ({
      body: {
        success: true,
        data: { ...POS_ANSWER.data, scope: { branch, branches: ['Centro', 'Norte'] } },
      },
    });

    it('says the figures cover every branch when none was named', async () => {
      mockPos(() => multiBranch(null));

      const result = (await run({ periodo: 'este_mes' })) as Record<string, unknown>;

      assert.equal(result.alcance, 'todas las sedes');
      assert.deepEqual(result.sedes_disponibles, ['Centro', 'Norte']);
    });

    it('says which branch the figures are for when one was named', async () => {
      mockPos(() => multiBranch('Norte'));

      const result = (await run({ periodo: 'este_mes', sede: 'norte' })) as Record<string, unknown>;

      assert.equal(result.alcance, 'sede Norte');
    });

    it('says nothing about branches for a business with only one', async () => {
      mockPos(() => ({ body: POS_ANSWER }));

      const result = (await run({ periodo: 'este_mes' })) as Record<string, unknown>;

      assert.ok(!('alcance' in result));
      assert.ok(!('sedes_disponibles' in result));
    });

    it("passes on the POS's refusal of an unknown branch, with the names it offers", async () => {
      mockPos(() => ({
        status: 422,
        body: { message: 'No active branch is called "Sur". Branches: Centro, Norte' },
      }));

      await assert.rejects(run({ periodo: 'hoy', sede: 'Sur' }), (error: unknown) => {
        assert.ok(error instanceof PosApiError);
        assert.match(error.message, /Centro, Norte/);
        return true;
      });
    });
  });

  describe('limits', () => {
    it('refuses more than a year without asking the POS', async () => {
      const requests = mockPos(() => ({ body: POS_ANSWER }));

      await assert.rejects(run({ desde: '2025-01-01', hasta: '2026-01-02' }), (error: unknown) => {
        assert.ok(error instanceof ToolRefusedError);
        assert.match(error.message, /366/);
        return true;
      });
      assert.equal(requests.length, 0);
    });

    it('accepts a whole previous month day by day, and refuses more than 31 days that way', async () => {
      const requests = mockPos(() => ({ body: POS_ANSWER }));

      await run({ desde: '2026-08-01', hasta: '2026-08-31', agrupar_por: 'dia' });
      assert.equal(requests.length, 1);

      await assert.rejects(run({ periodo: 'este_anio', agrupar_por: 'dia' }), ToolRefusedError);
      assert.equal(requests.length, 1);
    });
  });

  describe('parameters', () => {
    it('needs a period or a complete range, and not both', () => {
      for (const input of [
        {},
        { desde: '2026-10-01' },
        { hasta: '2026-10-01' },
        { periodo: 'hoy', desde: '2026-10-01', hasta: '2026-10-02' },
        { agrupar_por: 'dia' },
      ]) {
        assert.equal(consultarVentas.parse(input).ok, false, JSON.stringify(input));
      }
    });

    it('rejects natural language, impossible dates and backwards ranges', () => {
      for (const input of [
        { periodo: 'la semana pasada' },
        { desde: 'ayer', hasta: 'hoy' },
        { desde: '2026-02-30', hasta: '2026-03-01' },
        { desde: '01/10/2026', hasta: '13/10/2026' },
        { desde: '2026-10-13', hasta: '2026-10-01' },
      ]) {
        assert.equal(consultarVentas.parse(input).ok, false, JSON.stringify(input));
      }
    });

    it('rejects groupings, rankings and limits outside what it offers', () => {
      for (const input of [
        { periodo: 'hoy', agrupar_por: 'hora' },
        { periodo: 'hoy', orden_productos: 'precio' },
        { periodo: 'hoy', limite_productos: 11 },
        { periodo: 'hoy', limite_productos: 0 },
      ]) {
        assert.equal(consultarVentas.parse(input).ok, false, JSON.stringify(input));
      }
    });

    it('describes itself to the model with enums and no way to name a user, business or branch id', () => {
      const schema = consultarVentas.definition.input_schema as {
        properties: Record<string, { type?: string; enum?: string[]; maximum?: number }>;
        required?: string[];
      };

      assert.equal(consultarVentas.definition.name, 'consultar_ventas');
      assert.deepEqual(Object.keys(schema.properties).sort(), [
        'agrupar_por',
        'desde',
        'hasta',
        'incluir_productos_mas_vendidos',
        'limite_productos',
        'orden_productos',
        'periodo',
        'sede',
      ]);
      assert.ok(schema.properties.periodo.enum?.includes('semana_pasada'));
      assert.deepEqual(schema.properties.agrupar_por.enum, ['dia', 'semana', 'mes']);
      assert.deepEqual(schema.properties.orden_productos.enum, ['cantidad', 'ingresos']);
      assert.equal(schema.properties.limite_productos.maximum, 10);
      assert.deepEqual(schema.required ?? [], []);
    });
  });

  it('is offered only to a user who can read analytics', () => {
    assert.ok(toolsFor(session).includes(consultarVentas));
    assert.ok(!toolsFor(makeSession({ permissions: ['products.read'] })).includes(consultarVentas));
  });
});
