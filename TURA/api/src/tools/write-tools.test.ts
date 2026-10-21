import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { makeSession, mockPos, type PosRequest } from '../testing/fixtures.js';
import { ajustarExistencias } from './ajustar-existencias.js';
import { consultarInventario } from './consultar-inventario.js';
import { modificarInsumo } from './modificar-insumo.js';
import { modificarProducto } from './modificar-producto.js';
import { toolsFor } from './registry.js';
import { ToolRefusedError } from './types.js';

const ITEM_ID = '0b7c8d2e-9f1a-4c3b-8d5e-6f7a8b9c0d1e';
const PRODUCT_ID = '1c8d9e3f-0a2b-4d4c-9e6f-7a8b9c0d1e2f';

const item = (overrides: Record<string, unknown> = {}) => ({
  id: ITEM_ID,
  name: 'Papa',
  sku: null,
  unit: 'kg',
  isActive: true,
  minimumStock: 5,
  currentStock: 8,
  belowMinimum: false,
  branchId: 'branch-1',
  ...overrides,
});
const product = (overrides: Record<string, unknown> = {}) => ({
  id: PRODUCT_ID,
  name: 'Papas fritas',
  salePrice: 8000,
  isActive: true,
  isVisible: true,
  branchId: 'branch-1',
  ...overrides,
});

/** The POS answering reads with `read()` (which can change between calls) and accepting every write. */
function pos(read: () => unknown) {
  return mockPos((request: PosRequest) => ({
    body: { success: true, data: request.method === 'GET' ? read() : {} },
  }));
}

const session = makeSession({
  permissions: ['inventory.read', 'inventory.adjust', 'inventory.manage', 'products.read', 'products.update'],
});
/** Someone who may see every branch: their own is Centro. */
const owner = makeSession({
  permissions: [...session.permissions, 'branches.switch'],
  branches: {
    own: { id: 'branch-1', name: 'Centro' },
    canSeeAll: true,
    list: [
      { id: 'branch-1', name: 'Centro' },
      { id: 'branch-2', name: 'Norte' },
    ],
  },
});
const writes = (requests: PosRequest[]) => requests.filter((request) => request.method !== 'GET');

afterEach(() => mock.restoreAll());

describe('consultar_inventario', () => {
  it('gives the ids and the stock the changes need', async () => {
    const requests = mockPos(() => ({
      body: { success: true, data: { items: [item()], count: 1, total: 1 } },
    }));

    const result = await consultarInventario.execute({ buscar: 'papa' }, { session });

    assert.equal(requests[0].url.pathname.endsWith('/assistant/inventory'), true);
    assert.equal(requests[0].url.searchParams.get('search'), 'papa');
    assert.deepEqual(result, {
      total_coincidencias: 1,
      insumos: [
        { id: ITEM_ID, nombre: 'Papa', existencias: 8, unidad: 'kg', minimo: 5, bajo_el_minimo: false, activo: true },
      ],
    });
  });
});

describe('consultar_inventario across branches', () => {
  it('asks for the branch named, and labels each item with its branch', async () => {
    const requests = mockPos(() => ({
      body: {
        success: true,
        data: {
          items: [item({ branch: 'Centro' }), item({ id: 'i-2', branchId: 'branch-2', branch: 'Norte' })],
          count: 2,
          total: 2,
          scope: { branch: null, branches: ['Centro', 'Norte'] },
        },
      },
    }));

    const result = (await consultarInventario.execute({ buscar: 'papa' }, { session: owner })) as {
      alcance: string;
      insumos: { sede?: string }[];
    };
    await consultarInventario.execute({ buscar: 'papa', sede: 'Norte' }, { session: owner });

    assert.equal(requests[0].url.searchParams.get('branch'), null);
    assert.equal(requests[1].url.searchParams.get('branch'), 'Norte');
    assert.equal(result.alcance, 'todas las sedes');
    assert.deepEqual(
      result.insumos.map((insumo) => insumo.sede),
      ['Centro', 'Norte'],
    );
  });
});

describe('ajustar_existencias', () => {
  it('adds what came in, right away, and says how it was left', async () => {
    let stock = 8;
    const requests = pos(() => item({ currentStock: stock }));

    const promise = ajustarExistencias.run(
      { insumo_id: ITEM_ID, operacion: 'sumar', cantidad: 10, motivo: 'compra en plaza' },
      { session },
    );
    stock = 18; // what the POS holds after the adjustment, read back for the message
    const { message, branchId } = await promise;

    const [adjustment] = writes(requests);
    assert.equal(adjustment.url.pathname.endsWith('/inventory/adjustments'), true);
    assert.deepEqual(adjustment.body, {
      branchId: 'branch-1',
      inventoryItemId: ITEM_ID,
      direction: 'IN',
      quantity: 10,
      reason: 'compra en plaza (vía TURA)',
    });
    assert.equal(message, 'Listo: "Papa" quedó en 18 kg.');
    assert.equal(branchId, 'branch-1');
  });

  it('sets a count against the stock there is', async () => {
    const requests = pos(() => item({ currentStock: 6 }));

    await ajustarExistencias.run(
      { insumo_id: ITEM_ID, operacion: 'fijar', cantidad: 10, motivo: 'conteo del cierre' },
      { session },
    );

    assert.deepEqual(writes(requests)[0].body, {
      branchId: 'branch-1',
      inventoryItemId: ITEM_ID,
      direction: 'IN',
      quantity: 4,
      reason: 'conteo del cierre (vía TURA)',
    });
  });

  it('refuses to take out more than there is, changing nothing', async () => {
    const requests = pos(() => item());
    await assert.rejects(
      ajustarExistencias.run({ insumo_id: ITEM_ID, operacion: 'restar', cantidad: 9, motivo: 'se dañó' }, { session }),
      (error) => error instanceof ToolRefusedError && /no se pueden restar 9 kg/.test(error.message),
    );
    assert.deepEqual(writes(requests), []);
  });

  it('refuses a count that changes nothing', async () => {
    pos(() => item());
    await assert.rejects(
      ajustarExistencias.run({ insumo_id: ITEM_ID, operacion: 'fijar', cantidad: 8, motivo: 'conteo' }, { session }),
      ToolRefusedError,
    );
  });

  it("lets whoever may see every branch change another branch's item", async () => {
    const requests = pos(() => item({ branchId: 'branch-2' }));

    const { branchId } = await ajustarExistencias.run(
      { insumo_id: ITEM_ID, operacion: 'sumar', cantidad: 1, motivo: 'compra' },
      { session: owner },
    );

    assert.equal(writes(requests).length, 1);
    assert.equal(branchId, 'branch-2');
  });

  it("refuses another branch's item to someone kept to their branch", async () => {
    const requests = pos(() => item({ branchId: 'branch-2' }));
    await assert.rejects(
      ajustarExistencias.run({ insumo_id: ITEM_ID, operacion: 'sumar', cantidad: 1, motivo: 'compra' }, { session }),
      (error) => error instanceof ToolRefusedError && /otra sede/.test(error.message),
    );
    assert.deepEqual(writes(requests), []);
  });
});

describe('modificar_insumo', () => {
  it('deactivates an item', async () => {
    const requests = pos(() => item());

    const { message } = await modificarInsumo.run({ insumo_id: ITEM_ID, accion: 'desactivar' }, { session });

    const [change] = writes(requests);
    assert.equal(change.method, 'PATCH');
    assert.equal(change.url.pathname.endsWith(`/inventory-items/${ITEM_ID}/status`), true);
    assert.deepEqual(change.body, { isActive: false });
    assert.equal(message, 'Listo: "Papa" quedó desactivado.');
  });

  it('changes the minimum', async () => {
    const requests = pos(() => item());
    await modificarInsumo.run({ insumo_id: ITEM_ID, accion: 'cambiar_minimo', minimo: 12 }, { session });
    assert.deepEqual(writes(requests)[0].body, { minimumStock: 12 });
  });

  it('asks for what is missing, and refuses what is already so', async () => {
    const requests = pos(() => item({ isActive: false }));
    await assert.rejects(modificarInsumo.run({ insumo_id: ITEM_ID, accion: 'cambiar_minimo' }, { session }), /falta decir/);
    await assert.rejects(modificarInsumo.run({ insumo_id: ITEM_ID, accion: 'desactivar' }, { session }), /ya está desactivado/);
    assert.deepEqual(writes(requests), []);
  });
});

describe('modificar_producto', () => {
  it('deactivates a product', async () => {
    const requests = pos(() => product());

    const { message } = await modificarProducto.run({ producto_id: PRODUCT_ID, accion: 'desactivar' }, { session });

    const [change] = writes(requests);
    assert.equal(change.url.pathname.endsWith(`/products/${PRODUCT_ID}/status`), true);
    assert.deepEqual(change.body, { isActive: false });
    assert.equal(message, 'Listo: "Papas fritas" quedó desactivado.');
  });

  it('hides a product from the customer menu', async () => {
    const requests = pos(() => product());

    const { message } = await modificarProducto.run({ producto_id: PRODUCT_ID, accion: 'ocultar' }, { session });

    const [change] = writes(requests);
    assert.equal(change.url.pathname.endsWith(`/products/${PRODUCT_ID}/visibility`), true);
    assert.deepEqual(change.body, { isVisible: false });
    assert.match(message, /ya no aparece en el menú/);
  });

  it('changes the price', async () => {
    const requests = pos(() => product());

    const { message } = await modificarProducto.run(
      { producto_id: PRODUCT_ID, accion: 'cambiar_precio', precio: 9500 },
      { session },
    );

    assert.deepEqual(writes(requests)[0].body, { salePrice: 9500 });
    assert.match(message, /ahora cuesta 9\.500 pesos/);
  });

  it('refuses what is already so', async () => {
    const requests = pos(() => product({ isActive: false }));
    await assert.rejects(
      modificarProducto.run({ producto_id: PRODUCT_ID, accion: 'desactivar' }, { session }),
      /ya está desactivado/,
    );
    assert.deepEqual(writes(requests), []);
  });
});

describe('who is offered the changes', () => {
  const names = (permissions: string[]) =>
    toolsFor(makeSession({ permissions })).map((tool) => tool.definition.name);

  it('each change only with the permission the POS asks for it', () => {
    assert.deepEqual(names(['inventory.read']), ['consultar_inventario']);
    assert.deepEqual(names(['inventory.read', 'inventory.adjust']), ['consultar_inventario', 'ajustar_existencias']);
    assert.deepEqual(names(['products.read', 'products.update']), ['consultar_productos', 'modificar_producto']);
    assert.deepEqual(names(['inventory.manage']), ['modificar_insumo']);
  });
});
