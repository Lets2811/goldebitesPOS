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
  it('prepares without changing anything, and says what will happen', async () => {
    const requests = pos(() => item());

    const { summary } = await ajustarExistencias.prepare(
      { insumo_id: ITEM_ID, operacion: 'sumar', cantidad: 10, motivo: 'compra en plaza' },
      { session },
    );

    assert.equal(summary, 'Sumar 10 kg a "Papa": pasa de 8 kg a 18 kg. Motivo: compra en plaza.');
    assert.deepEqual(writes(requests), []);
  });

  it('refuses to take out more than there is', async () => {
    pos(() => item());
    await assert.rejects(
      ajustarExistencias.prepare({ insumo_id: ITEM_ID, operacion: 'restar', cantidad: 9, motivo: 'se dañó' }, { session }),
      (error) => error instanceof ToolRefusedError && /no se pueden restar 9 kg/.test(error.message),
    );
  });

  it('refuses a count that changes nothing', async () => {
    pos(() => item());
    await assert.rejects(
      ajustarExistencias.prepare({ insumo_id: ITEM_ID, operacion: 'fijar', cantidad: 8, motivo: 'conteo' }, { session }),
      ToolRefusedError,
    );
  });

  it("lets whoever may see every branch change another branch's item, naming the branch", async () => {
    pos(() => item({ branchId: 'branch-2' }));

    const { summary } = await ajustarExistencias.prepare(
      { insumo_id: ITEM_ID, operacion: 'sumar', cantidad: 1, motivo: 'compra' },
      { session: owner },
    );

    assert.equal(summary, 'Sumar 1 kg a "Papa": pasa de 8 kg a 9 kg. Motivo: compra. Sede: Norte.');
  });

  it("refuses another branch's item", async () => {
    pos(() => item({ branchId: 'branch-2' }));
    await assert.rejects(
      ajustarExistencias.prepare({ insumo_id: ITEM_ID, operacion: 'sumar', cantidad: 1, motivo: 'compra' }, { session }),
      (error) => error instanceof ToolRefusedError && /otra sede/.test(error.message),
    );
  });

  it('commits a count against the stock there is when confirmed, not when prepared', async () => {
    // Prepared at 8; by the time it is confirmed 2 more were used: 6 on hand.
    let stock = 6;
    const requests = pos(() => item({ currentStock: stock }));
    const args = { insumo_id: ITEM_ID, operacion: 'fijar' as const, cantidad: 10, motivo: 'conteo del cierre' };

    const promise = ajustarExistencias.commit(args, { session });
    stock = 10; // what the POS holds after the adjustment, read back for the message
    const { message } = await promise;

    const [adjustment] = writes(requests);
    assert.equal(adjustment.url.pathname.endsWith('/inventory/adjustments'), true);
    assert.deepEqual(adjustment.body, {
      branchId: 'branch-1',
      inventoryItemId: ITEM_ID,
      direction: 'IN',
      quantity: 4,
      reason: 'conteo del cierre (vía TURA)',
    });
    assert.equal(message, 'Listo: "Papa" quedó en 10 kg.');
  });
});

describe('modificar_insumo', () => {
  it('deactivates an item when confirmed', async () => {
    const requests = pos(() => item());
    const args = { insumo_id: ITEM_ID, accion: 'desactivar' as const };

    const { summary } = await modificarInsumo.prepare(args, { session });
    assert.match(summary, /Desactivar el insumo "Papa"/);
    assert.deepEqual(writes(requests), []);

    await modificarInsumo.commit(args, { session });
    const [change] = writes(requests);
    assert.equal(change.method, 'PATCH');
    assert.equal(change.url.pathname.endsWith(`/inventory-items/${ITEM_ID}/status`), true);
    assert.deepEqual(change.body, { isActive: false });
  });

  it('changes the minimum', async () => {
    const requests = pos(() => item());
    await modificarInsumo.commit({ insumo_id: ITEM_ID, accion: 'cambiar_minimo', minimo: 12 }, { session });
    assert.deepEqual(writes(requests)[0].body, { minimumStock: 12 });
  });

  it('asks for what is missing, and refuses what is already so', async () => {
    pos(() => item({ isActive: false }));
    await assert.rejects(modificarInsumo.prepare({ insumo_id: ITEM_ID, accion: 'cambiar_minimo' }, { session }), /falta decir/);
    await assert.rejects(modificarInsumo.prepare({ insumo_id: ITEM_ID, accion: 'desactivar' }, { session }), /ya está desactivado/);
  });
});

describe('modificar_producto', () => {
  it('hides a product from the customer menu, telling it still sells in the POS', async () => {
    const requests = pos(() => product());
    const args = { producto_id: PRODUCT_ID, accion: 'ocultar' as const };

    const { summary } = await modificarProducto.prepare(args, { session });
    assert.equal(summary, 'Ocultar "Papas fritas" del menú de los clientes: se sigue vendiendo en el POS.');

    await modificarProducto.commit(args, { session });
    const [change] = writes(requests);
    assert.equal(change.url.pathname.endsWith(`/products/${PRODUCT_ID}/visibility`), true);
    assert.deepEqual(change.body, { isVisible: false });
  });

  it('changes the price', async () => {
    const requests = pos(() => product());
    const args = { producto_id: PRODUCT_ID, accion: 'cambiar_precio' as const, precio: 9500 };

    const { summary } = await modificarProducto.prepare(args, { session });
    assert.match(summary, /de 8\.000 pesos a 9\.500 pesos/);

    const { message } = await modificarProducto.commit(args, { session });
    assert.deepEqual(writes(requests)[0].body, { salePrice: 9500 });
    assert.match(message, /ahora cuesta 9\.500 pesos/);
  });

  it('refuses what is already so', async () => {
    pos(() => product({ isActive: false }));
    await assert.rejects(
      modificarProducto.prepare({ producto_id: PRODUCT_ID, accion: 'desactivar' }, { session }),
      /ya está desactivado/,
    );
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
