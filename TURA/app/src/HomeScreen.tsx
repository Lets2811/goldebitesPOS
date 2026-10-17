import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { AiModeBadge } from './AiModeBadge';
import { ChatIcon, MicIcon } from './icons';
import { getLink, getLinks, redeemLink, subscribe, switchLink, unlink } from './link';
import { parseCode } from './onboarding';
import { navigate } from './route';

const UNLINK_WARNING =
  '¿Desvincular este dispositivo del negocio? Tendrás que pedir un código nuevo para volver a conectarlo.';

/**
 * Links this device to one more business, with a code from its POS. The first
 * link is made by talking to TURA (onboarding.ts); this is for the next ones.
 */
function AddBusiness({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseCode(code);
    if (!parsed) {
      setError('El código tiene seis dígitos.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await redeemLink(parsed);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pude vincular esa empresa.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="businesses__add" onSubmit={(event) => void submit(event)}>
      <label htmlFor="link-code">Código de vinculación de la otra empresa</label>
      <div className="businesses__add-row">
        <input
          id="link-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={12}
          placeholder="000000"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoFocus
        />
        <button type="submit" className="businesses__submit" disabled={busy}>
          {busy ? 'Vinculando…' : 'Vincular'}
        </button>
      </div>
      {error && <p className="businesses__error">{error}</p>}
      <button type="button" className="home__unlink" onClick={onDone}>
        Cancelar
      </button>
    </form>
  );
}

export function HomeScreen() {
  const link = useSyncExternalStore(subscribe, getLink);
  const links = useSyncExternalStore(subscribe, getLinks);
  const [adding, setAdding] = useState(false);
  // Two users of the same business are told apart by name.
  const label = (item: { businessName: string; userName: string }) =>
    links.filter((other) => other.businessName === item.businessName).length > 1
      ? `${item.businessName} · ${item.userName}`
      : item.businessName;

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__brand">TURA</h1>
        <AiModeBadge />
        <button type="button" className="screen__action" onClick={() => navigate('admin')}>
          Costos
        </button>
      </header>

      <main className="home">
        <div className="home__greeting">
          <h2>{link ? `Hola, ${link.userName}` : 'Hola'}</h2>
          {link ? (
            <p>
              Conectado con {link.businessName}.{' '}
              <button
                type="button"
                className="home__unlink"
                onClick={() => window.confirm(UNLINK_WARNING) && unlink()}
              >
                Desvincular
              </button>
            </p>
          ) : (
            <p>Todavía no estoy conectado con tu negocio. Entra al chat o háblame para vincularnos.</p>
          )}
        </div>

        {link && (
          <section className="businesses" aria-label="Empresas vinculadas">
            {links.length > 1 && (
              <div className="businesses__list" role="radiogroup" aria-label="Empresa activa">
                {links.map((item, index) => (
                  <button
                    key={`${item.businessName}-${item.userName}`}
                    type="button"
                    role="radio"
                    aria-checked={item === link}
                    className={`businesses__chip${item === link ? ' businesses__chip--active' : ''}`}
                    onClick={() => switchLink(index)}
                  >
                    {label(item)}
                  </button>
                ))}
              </div>
            )}
            {adding ? (
              <AddBusiness onDone={() => setAdding(false)} />
            ) : (
              <button type="button" className="home__unlink" onClick={() => setAdding(true)}>
                + Agregar otra empresa
              </button>
            )}
          </section>
        )}

        <nav className="home__options">
          <button type="button" className="option" onClick={() => navigate('chat')}>
            <span className="option__icon option__icon--gold">
              <ChatIcon />
            </span>
            <span className="option__text">
              <strong>Chat</strong>
              <span>Escribe tus preguntas</span>
            </span>
          </button>

          <button type="button" className="option" onClick={() => navigate('voice')}>
            <span className="option__icon option__icon--blue">
              <MicIcon />
            </span>
            <span className="option__text">
              <strong>Hablar</strong>
              <span>Conversa con tu voz</span>
            </span>
          </button>
        </nav>
      </main>
    </div>
  );
}
