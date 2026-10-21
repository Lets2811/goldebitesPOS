import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemoryPendingActionStore } from './pending-actions.js';

describe('pending actions', () => {
  let now = 1_000_000;
  const store = () => new MemoryPendingActionStore(60_000, () => now);
  const action = (expiresInMs = 60_000) => ({
    tool: 'modificar_producto',
    summary: 'Ocultar "Papas"',
    input: { producto_id: 'p' },
    userId: 'user-1',
    turn: 1,
    expiresAt: new Date(now + expiresInMs).toISOString(),
  });

  it('hands an action over once, to its own user', async () => {
    const actions = store();
    const created = await actions.create(action());

    assert.equal(await actions.take(created.id, 'someone-else'), null);
    assert.equal((await actions.take(created.id, 'user-1'))?.summary, 'Ocultar "Papas"');
    assert.equal(await actions.take(created.id, 'user-1'), null);
  });

  it('cannot be confirmed once expired', async () => {
    const actions = store();
    const created = await actions.create(action(1000));
    now += 2000;
    assert.equal(await actions.take(created.id, 'user-1'), null);
  });

  it('is gone once discarded by its user, and only by them', async () => {
    const actions = store();
    const created = await actions.create(action());
    await actions.discard(created.id, 'someone-else');
    await actions.discard(created.id, 'user-1');
    assert.equal(await actions.take(created.id, 'user-1'), null);
  });

  it('hands over, once, what was prepared in a given turn of its user', async () => {
    const actions = store();
    const turn = await actions.beginTurn('user-1');
    await actions.create({ ...action(), turn });
    await actions.create({ ...action(), turn, userId: 'someone-else' });
    await actions.create({ ...action(), turn: turn + 1 });

    assert.equal(await actions.beginTurn('user-1'), turn + 1);
    assert.equal((await actions.takeFromTurn('user-1', turn)).length, 1);
    assert.equal((await actions.takeFromTurn('user-1', turn)).length, 0);
  });

  it('does not hand over an expired one', async () => {
    const actions = store();
    await actions.create({ ...action(1000), turn: 1 });
    now += 2000;
    assert.deepEqual(await actions.takeFromTurn('user-1', 1), []);
  });
});
