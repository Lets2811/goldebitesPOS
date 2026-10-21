import { useState } from 'react';
import { confirmAction, discardAction, type PendingChange } from './tura-client';

export type ActionOutcome =
  | { state: 'done'; message: string }
  | { state: 'failed'; message: string }
  | { state: 'cancelled' };

type CardState = 'pending' | 'working' | ActionOutcome['state'];

/** What became of a change, told to TURA in the conversation (it never sees the buttons). */
export function describeChangeOutcome(summary: string, outcome: ActionOutcome): string {
  switch (outcome.state) {
    case 'done':
      return `[El usuario confirmó el cambio y quedó hecho] ${outcome.message}`;
    case 'failed':
      return `[El usuario confirmó el cambio pero no se hizo] ${summary} ${outcome.message}`;
    case 'cancelled':
      return `[El usuario canceló el cambio] ${summary}`;
  }
}

/**
 * A change TURA prepared, shown as it is: nothing happens in the POS until
 * the user says yes to TURA, or taps "Confirmar". The answer (or why it
 * could not be done) stays on the card.
 */
export function ActionCard({
  action,
  outcome,
  onSettled,
}: {
  action: PendingChange;
  /** What became of it when the user answered TURA in the conversation instead of with the buttons. */
  outcome?: ActionOutcome;
  onSettled?: (outcome: ActionOutcome) => void;
}) {
  const [tapped, setState] = useState<CardState>('pending');
  const [tappedMessage, setMessage] = useState('');
  const state: CardState = outcome?.state ?? tapped;
  const message = outcome && outcome.state !== 'cancelled' ? outcome.message : tappedMessage;

  async function confirm() {
    setState('working');
    try {
      const done = await confirmAction(action.id);
      setState('done');
      setMessage(done);
      onSettled?.({ state: 'done', message: done });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'No se pudo hacer el cambio.';
      setState('failed');
      setMessage(reason);
      onSettled?.({ state: 'failed', message: reason });
    }
  }

  function cancel() {
    setState('cancelled');
    void discardAction(action.id);
    onSettled?.({ state: 'cancelled' });
  }

  return (
    <section className={`action-card action-card--${state}`} aria-live="polite">
      <p className="action-card__label">
        {state === 'done'
          ? 'Cambio hecho'
          : state === 'failed'
            ? 'No se hizo el cambio'
            : state === 'cancelled'
              ? 'Cambio cancelado'
              : 'Cambio por confirmar'}
      </p>
      <p className="action-card__summary">{action.summary}</p>
      {state === 'pending' && <p className="action-card__hint">Dile «sí» a TURA para hacerlo, o «no» para dejarlo.</p>}
      {message && <p className="action-card__result">{message}</p>}
      {(state === 'pending' || state === 'working') && (
        <div className="action-card__buttons">
          <button type="button" className="button button--ghost" onClick={cancel} disabled={state === 'working'}>
            Cancelar
          </button>
          <button type="button" className="button" onClick={() => void confirm()} disabled={state === 'working'}>
            {state === 'working' ? 'Haciendo el cambio…' : 'Confirmar'}
          </button>
        </div>
      )}
    </section>
  );
}
