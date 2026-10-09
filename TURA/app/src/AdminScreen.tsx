import { useEffect, useState, type FormEvent } from 'react';
import { BackIcon } from './icons';
import { navigate } from './route';

const ADMIN_KEY = 'tura-admin-key';
const PERIODS = [1, 7, 30];

interface Group {
  key: string;
  turns: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

/** Body of GET /tura/admin/usage (see summarizeUsage in TURA/api). */
interface Usage {
  days: number;
  currentModel: string;
  totals: {
    turns: number;
    errors: number;
    withTools: number;
    costUsd: number;
    costPerTurnUsd: number | null;
    projectedMonthlyUsd: number | null;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
  };
  latency: { firstTextMs: number | null; firstTextSlowMs: number | null; totalMs: number | null };
  byModel: Group[];
  byMode: Group[];
  byDay: Group[];
  whatIf: { model: string; price: { input: number; output: number } | null; costUsd: number | null }[];
  unpricedModels: string[];
  recent: {
    at: string;
    mode: string;
    outcome: 'ok' | 'error' | 'cancelled';
    model: string | null;
    tools: string[];
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    firstTextMs: number | null;
    totalMs: number;
  }[];
}

const MODES: Record<string, string> = { chat: 'Chat', voice: 'Voz', introduction: 'Voz' };
const OUTCOMES = { ok: '', error: 'falló', cancelled: 'cancelado' };

/** Amounts here are fractions of a cent per turn, so small ones keep four decimals. */
function usd(value: number | null): string {
  if (value === null) {
    return '—';
  }
  return `$${value.toFixed(value !== 0 && value < 1 ? 4 : 2)}`;
}

function seconds(ms: number | null): string {
  return ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`;
}

function count(value: number): string {
  return value.toLocaleString('es-CO');
}

function shortModel(model: string): string {
  return model.replace(/^claude-/, '');
}

function GroupTable({ title, unit, groups, label }: {
  title: string;
  unit: string;
  groups: Group[];
  label: (key: string) => string;
}) {
  return (
    <section className="admin__section">
      <h2>{title}</h2>
      <table className="admin__table">
        <thead>
          <tr>
            <th />
            <th>{unit}</th>
            <th>Entrada</th>
            <th>Salida</th>
            <th>Costo</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.key}>
              <th>{label(group.key)}</th>
              <td>{count(group.turns)}</td>
              <td>{count(group.inputTokens)}</td>
              <td>{count(group.outputTokens)}</td>
              <td>{usd(group.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/**
 * What TURA costs to run, for the developer: spend, speed and what the same
 * usage would cost on another model. It is not part of the product, so it has
 * its own key instead of a POS permission.
 */
export function AdminScreen() {
  const [key, setKey] = useState(() => localStorage.getItem(ADMIN_KEY) ?? '');
  const [draft, setDraft] = useState('');
  const [days, setDays] = useState(7);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!key) {
      return;
    }
    const abort = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/tura/admin/usage?days=${days}`, {
          headers: { Authorization: `Bearer ${key}` },
          signal: abort.signal,
        });
        if (response.status === 401) {
          localStorage.removeItem(ADMIN_KEY);
          setKey('');
          setError('La clave no es correcta.');
          return;
        }
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? 'No se pudo cargar el uso.');
        }
        setUsage((await response.json()) as Usage);
        setError('');
      } catch (cause) {
        if (!abort.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'No se pudo cargar el uso.');
        }
      }
    })();
    return () => abort.abort();
  }, [key, days, reload]);

  function unlock(event: FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (value) {
      localStorage.setItem(ADMIN_KEY, value);
      setDraft('');
      setError('');
      setKey(value);
    }
  }

  return (
    <div className="screen">
      <header className="screen__header">
        <button
          type="button"
          className="screen__action screen__action--icon"
          aria-label="Volver al menú"
          onClick={() => navigate('home')}
        >
          <BackIcon />
        </button>
        <h1 className="screen__title">Costos</h1>
        {key && (
          <button type="button" className="screen__action" onClick={() => setReload(reload + 1)}>
            Actualizar
          </button>
        )}
      </header>

      <main className="admin">
        {!key && (
          <form className="admin__unlock" onSubmit={unlock}>
            <label>
              Clave de administración
              <input
                type="password"
                autoComplete="off"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
            <p className="admin__note">Es el valor de TURA_ADMIN_KEY en el .env del servicio.</p>
            <button type="submit" className="button">
              Entrar
            </button>
          </form>
        )}
        {error && <p className="admin__error">{error}</p>}

        {key && usage && (
          <>
            <div className="admin__periods" role="group" aria-label="Periodo">
              {PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  aria-pressed={period === days}
                  onClick={() => setDays(period)}
                >
                  {period === 1 ? 'Hoy' : `${period} días`}
                </button>
              ))}
            </div>

            {usage.totals.turns === 0 ? (
              <p className="admin__note">
                Todavía no hay conversaciones registradas en este periodo. Escríbele o háblale a
                TURA y vuelve a esta pantalla.
              </p>
            ) : (
              <>
                <section className="admin__section">
                  <h2>Gasto</h2>
                  <dl className="admin__facts">
                    <div>
                      <dt>Total del periodo</dt>
                      <dd>{usd(usage.totals.costUsd)}</dd>
                    </div>
                    <div>
                      <dt>Por conversación</dt>
                      <dd>{usd(usage.totals.costPerTurnUsd)}</dd>
                    </div>
                    <div>
                      <dt>Proyección a 30 días</dt>
                      <dd>{usd(usage.totals.projectedMonthlyUsd)}</dd>
                    </div>
                    <div>
                      <dt>Conversaciones</dt>
                      <dd>{count(usage.totals.turns)}</dd>
                    </div>
                    <div>
                      <dt>Consultaron el POS</dt>
                      <dd>{count(usage.totals.withTools)}</dd>
                    </div>
                    <div>
                      <dt>Fallaron</dt>
                      <dd>{count(usage.totals.errors)}</dd>
                    </div>
                  </dl>
                  <p className="admin__note">
                    En dólares, a precio de lista. La proyección asume el ritmo de uso desde la
                    primera conversación del periodo.
                  </p>
                </section>

                <section className="admin__section">
                  <h2>Velocidad</h2>
                  <dl className="admin__facts">
                    <div>
                      <dt>Empieza a responder</dt>
                      <dd>{seconds(usage.latency.firstTextMs)}</dd>
                    </div>
                    <div>
                      <dt>En los casos lentos</dt>
                      <dd>{seconds(usage.latency.firstTextSlowMs)}</dd>
                    </div>
                    <div>
                      <dt>Respuesta completa</dt>
                      <dd>{seconds(usage.latency.totalMs)}</dd>
                    </div>
                  </dl>
                  <p className="admin__note">
                    En voz, lo que se siente es cuánto tarda en empezar a responder. "Casos lentos"
                    es el tiempo que solo supera 1 de cada 10 conversaciones.
                  </p>
                </section>

                <section className="admin__section">
                  <h2>El mismo uso en otro modelo</h2>
                  <table className="admin__table">
                    <thead>
                      <tr>
                        <th />
                        <th>Entrada</th>
                        <th>Salida</th>
                        <th>Costo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.whatIf.map((option) => (
                        <tr key={option.model}>
                          <th>
                            {shortModel(option.model)}
                            {usage.currentModel.startsWith(option.model) && ' (actual)'}
                          </th>
                          <td>{option.price ? `$${option.price.input}` : '—'}</td>
                          <td>{option.price ? `$${option.price.output}` : '—'}</td>
                          <td>{usd(option.costUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="admin__note">
                    Precio por millón de tokens y lo que habría costado este periodo. Es una guía:
                    otro modelo no gasta exactamente los mismos tokens ni responde igual de bien.
                  </p>
                </section>

                <GroupTable
                  title="Por canal"
                  unit="Conv."
                  groups={usage.byMode}
                  label={(mode) => MODES[mode] ?? mode}
                />
                <GroupTable
                  title="Por modelo"
                  unit="Llamadas"
                  groups={usage.byModel}
                  label={shortModel}
                />
                <GroupTable title="Por día" unit="Conv." groups={usage.byDay} label={(day) => day} />

                {usage.unpricedModels.length > 0 && (
                  <p className="admin__error">
                    Sin precio registrado, cuentan como $0: {usage.unpricedModels.join(', ')}.
                  </p>
                )}

                <section className="admin__section">
                  <h2>Últimas conversaciones</h2>
                  <ul className="admin__turns">
                    {usage.recent.map((turn) => (
                      <li key={turn.at}>
                        <div>
                          <strong>{usd(turn.costUsd)}</strong>
                          <span>
                            {new Date(turn.at).toLocaleString('es-CO', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                        <p>
                          {[
                            MODES[turn.mode] ?? turn.mode,
                            turn.model && shortModel(turn.model),
                            `${count(turn.inputTokens)} + ${count(turn.outputTokens)} tokens`,
                            `empezó en ${seconds(turn.firstTextMs)}`,
                            turn.tools.length > 0 && `POS: ${turn.tools.join(', ')}`,
                            OUTCOMES[turn.outcome],
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
