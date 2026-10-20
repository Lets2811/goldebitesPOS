import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { PosApiError } from '../pos/pos-client.js';
import { makeSession, mockPos } from '../testing/fixtures.js';
import { consultarProductos } from './consultar-productos.js';
import { toolsFor } from './registry.js';

/** What GET /assistant/products answers for a search that matches one product of each kind. */
const POS_ANSWER = {
  success: true,
  data: {
    items: [
      {
        id: 'p-1',
        name: 'Agua manantial',
        description: null,
        sku: 'Botella',
        categoryId: 'c-1',
        salePrice: 6000,
        isActive: true,
        isVisible: true,
        inventory: {
          controlled: true,
          mode: 'DIRECT',
          itemId: 'i-1',
          itemName: 'Agua botella manantial',
          unit: 'botella',
          quantityPerUnit: 1,
          currentStock: 9,
        },
      },
      {
        id: 'p-2',
        name: 'Combo Individual',
        description: '3 tenders de pollo',
        sku: null,
        categoryId: 'c-2',
        salePrice: 20000,
        isActive: true,
        isVisible: false,
        inventory: { controlled: false },
      },
      {
        id: 'p-3',
        name: 'Nuggets x6',
        description: null,
        sku: null,
        categoryId: 'c-2',
        salePrice: 12000,
        isActive: true,
        isVisible: true,
        inventory: { controlled: true, mode: 'RECIPE', ingredientCount: 2, currentStock: null },
      },
      {
        id: 'p-4',
        name: 'Gaseosa',
        description: null,
        sku: null,
        categoryId: 'c-1',
        salePrice: 4000,
        isActive: true,
        isVisible: true,
        inventory: {
          controlled: true,
          mode: 'DIRECT',
          currentStock: null,
          stockUnavailableReason: 'NO_INVENTORY_ACCESS',
        },
      },
    ],
    count: 4,
    total: 12,
    stockBranchId: 'branch-1',
  },
};

function run(input: unknown) {
  const parsed = consultarProductos.parse(input);
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
  return consultarProductos.execute(parsed.value, { session: makeSession() });
}

describe('consultar_productos', () => {
  afterEach(() => mock.restoreAll());

  it('calls GET /assistant/products with the user token and the mapped filters', async () => {
    const requests = mockPos(() => ({ body: POS_ANSWER }));

    await run({ buscar: 'agua', solo_activos: true, solo_visibles: false, limite: 5 });

    assert.equal(requests.length, 1);
    const [{ url, authorization }] = requests;
    assert.equal(url.pathname, '/api/v1/assistant/products');
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      search: 'agua',
      isActive: 'true',
      isVisible: 'false',
      limit: '5',
    });
    assert.equal(authorization, 'Bearer user-access-token');
  });

  it('asks the POS to order by stock, lowest or highest first', async () => {
    const requests = mockPos(() => ({ body: POS_ANSWER }));

    await run({ ordenar_por_existencias: 'menor', limite: 5 });
    await run({ ordenar_por_existencias: 'mayor', solo_activos: true });

    assert.deepEqual(Object.fromEntries(requests[0].url.searchParams), {
      limit: '5',
      sortBy: 'stock',
      sortOrder: 'asc',
    });
    assert.deepEqual(Object.fromEntries(requests[1].url.searchParams), {
      isActive: 'true',
      sortBy: 'stock',
      sortOrder: 'desc',
    });
  });

  it('sends no filter the user did not ask for, and never a user, business or branch', async () => {
    const requests = mockPos(() => ({ body: POS_ANSWER }));

    await run({});

    assert.deepEqual([...requests[0].url.searchParams.keys()], []);
  });

  it('returns what the model needs, in its own words, with the id a change refers to', async () => {
    mockPos(() => ({ body: POS_ANSWER }));

    const result = await run({ buscar: 'a' });

    assert.deepEqual(result, {
      total_coincidencias: 12,
      productos: [
        {
          id: 'p-1',
          nombre: 'Agua manantial',
          sku: 'Botella',
          precio: 6000,
          activo: true,
          visible_en_menu: true,
          controla_inventario: true,
          existencias: 9,
          unidad: 'botella',
        },
        {
          id: 'p-2',
          nombre: 'Combo Individual',
          descripcion: '3 tenders de pollo',
          precio: 20000,
          activo: true,
          visible_en_menu: false,
          controla_inventario: false,
        },
        {
          id: 'p-3',
          nombre: 'Nuggets x6',
          precio: 12000,
          activo: true,
          visible_en_menu: true,
          controla_inventario: true,
          existencias: null,
          motivo_sin_existencias:
            'se prepara con una receta de 2 ingredientes; el POS no calcula cuántas unidades se pueden preparar',
        },
        {
          id: 'p-4',
          nombre: 'Gaseosa',
          precio: 4000,
          activo: true,
          visible_en_menu: true,
          controla_inventario: true,
          existencias: null,
          motivo_sin_existencias: 'el usuario no tiene permiso para ver inventario',
        },
      ],
    });
    // The inventory item behind a product stays internal: only the product's own id is given.
    assert.ok(!JSON.stringify(result).includes('i-1'));
  });

  it('keeps a real stock of zero as zero', async () => {
    const [water] = POS_ANSWER.data.items;
    const soldOut = { ...water, inventory: { ...water.inventory, currentStock: 0 } };
    mockPos(() => ({ body: { ...POS_ANSWER, data: { ...POS_ANSWER.data, items: [soldOut] } } }));

    const result = (await run({ buscar: 'agua' })) as { productos: { existencias: number }[] };

    assert.equal(result.productos[0].existencias, 0);
  });

  it("surfaces the POS's refusal as a PosApiError carrying its status and message", async () => {
    mockPos(() => ({
      status: 403,
      body: { message: 'This action requires the following permission(s): products.read' },
    }));

    await assert.rejects(run({ buscar: 'agua' }), (error: unknown) => {
      assert.ok(error instanceof PosApiError);
      assert.equal(error.status, 403);
      assert.match(error.message, /products\.read/);
      return true;
    });
  });

  it('reports a POS that cannot be reached', async () => {
    mockPos(() => new TypeError('fetch failed'));

    await assert.rejects(run({}), (error: unknown) => {
      assert.ok(error instanceof PosApiError);
      assert.equal(error.status, 503);
      return true;
    });
  });

  it('rejects parameters outside its schema before calling the POS', () => {
    const requests = mockPos(() => ({ body: POS_ANSWER }));

    for (const input of [
      { limite: 50 },
      { limite: 0 },
      { buscar: '' },
      { solo_activos: 'si' },
      { ordenar_por_existencias: 'precio' },
    ]) {
      const parsed = consultarProductos.parse(input);
      assert.equal(parsed.ok, false, JSON.stringify(input));
    }
    assert.equal(requests.length, 0);
  });

  it('describes its parameters to the model with types, limits and nothing required', () => {
    const schema = consultarProductos.definition.input_schema as {
      type: string;
      properties: Record<string, { type: string; maximum?: number; enum?: string[] }>;
      required?: string[];
    };

    assert.equal(consultarProductos.definition.name, 'consultar_productos');
    assert.equal(schema.type, 'object');
    assert.deepEqual(Object.keys(schema.properties).sort(), [
      'buscar',
      'limite',
      'ordenar_por_existencias',
      'solo_activos',
      'solo_visibles',
    ]);
    assert.equal(schema.properties.buscar.type, 'string');
    assert.equal(schema.properties.solo_activos.type, 'boolean');
    assert.equal(schema.properties.limite.type, 'integer');
    assert.equal(schema.properties.limite.maximum, 20);
    assert.deepEqual(schema.properties.ordenar_por_existencias.enum, ['menor', 'mayor']);
    assert.deepEqual(schema.required ?? [], []);
  });

  it('is offered only to a user who can read products', () => {
    assert.ok(toolsFor(makeSession()).includes(consultarProductos));
    assert.ok(!toolsFor(makeSession({ permissions: ['inventory.read'] })).includes(consultarProductos));
  });
});
