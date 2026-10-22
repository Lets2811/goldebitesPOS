import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { makeSession, mockPos } from '../testing/fixtures.js';
import { compararSedes } from './comparar-sedes.js';
import { toolsFor } from './registry.js';
import { ToolRefusedError } from './types.js';

const owner = makeSession({ permissions: ['analytics.read', 'branches.switch'] });

const POS_ANSWER = {
  success: true,
  data: {
    period: { from: '2026-10-01', to: '2026-10-13', timezone: 'America/Bogota' },
    branches: [
      {
        name: 'Centro',
        isActive: true,
        totalSales: 1200000,
        orderCount: 80,
        averageTicket: 15000,
        discountTotal: 20000,
        expenseTotal: 300000,
        wasteTotal: 12000,
        activeOrders: 3,
        cashOpen: true,
      },
      {
        name: 'Norte',
        isActive: false,
        totalSales: 0,
        orderCount: 0,
        averageTicket: 0,
        discountTotal: 0,
        expenseTotal: 0,
        wasteTotal: 0,
        activeOrders: 0,
        cashOpen: false,
      },
    ],
  },
};

afterEach(() => mock.restoreAll());

describe('comparar_sedes', () => {
  it('asks the POS for the days of the range and gives each branch its figures', async () => {
    const requests = mockPos(() => ({ body: POS_ANSWER }));

    const result = await compararSedes.execute({ desde: '2026-10-01', hasta: '2026-10-13' }, { session: owner });

    assert.equal(requests[0].url.pathname.endsWith('/assistant/branch-comparison'), true);
    assert.equal(requests[0].url.searchParams.get('dateFrom'), '2026-10-01');
    assert.equal(requests[0].url.searchParams.get('dateTo'), '2026-10-13');
    assert.deepEqual(result, {
      periodo: { desde: '2026-10-01', hasta: '2026-10-13' },
      sedes: [
        {
          sede: 'Centro',
          total_vendido: 1200000,
          numero_ventas: 80,
          ticket_promedio: 15000,
          descuentos: 20000,
          gastos: 300000,
          mermas: 12000,
          ahora: { pedidos_en_curso: 3, caja_abierta: true },
        },
        {
          sede: 'Norte',
          inactiva: true,
          total_vendido: 0,
          numero_ventas: 0,
          ticket_promedio: 0,
          descuentos: 0,
          gastos: 0,
          mermas: 0,
          ahora: { pedidos_en_curso: 0, caja_abierta: false },
        },
      ],
    });
  });

  it('refuses a range longer than the POS takes, without asking it', async () => {
    const requests = mockPos(() => ({ body: POS_ANSWER }));

    await assert.rejects(
      compararSedes.execute({ desde: '2024-01-01', hasta: '2026-01-01' }, { session: owner }),
      ToolRefusedError,
    );
    assert.equal(requests.length, 0);
  });

  it('is offered only to whoever may see every branch', () => {
    assert.ok(toolsFor(owner).includes(compararSedes));
    assert.ok(!toolsFor(makeSession({ permissions: ['analytics.read'] })).includes(compararSedes));
  });
});
