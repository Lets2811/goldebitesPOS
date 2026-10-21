import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeSession } from '../testing/fixtures.js';
import { buildSystemPrompt } from './system-prompt.js';

const centro = { id: 'branch-1', name: 'Centro' };
const norte = { id: 'branch-2', name: 'Norte' };

const context = (session: ReturnType<typeof makeSession>) => buildSystemPrompt(session, 'chat')[1].text;

describe('the branches in the prompt', () => {
  it('names every branch to whoever may see them all', () => {
    const text = context(makeSession({ branches: { own: centro, canSeeAll: true, list: [centro, norte] } }));

    assert.match(text, /2 sedes \(Centro, Norte\) y puede consultarlas todas; trabaja en Centro/);
  });

  it('keeps someone who works at one branch to it', () => {
    const text = context(makeSession({ branches: { own: norte, canSeeAll: false, list: [norte] } }));

    assert.match(text, /Trabaja en la sede Norte y solo puede consultar esa sede/);
    assert.doesNotMatch(text, /Centro/);
  });

  it('says nothing about branches when there is only one', () => {
    assert.doesNotMatch(context(makeSession()), /sede/);
  });

  it('keeps the branches out of the cached rules', () => {
    const [rules] = buildSystemPrompt(
      makeSession({ branches: { own: centro, canSeeAll: true, list: [centro, norte] } }),
      'chat',
    );

    assert.doesNotMatch(rules.text, /Centro|Norte/);
  });
});
