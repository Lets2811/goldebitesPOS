import { useSyncExternalStore } from 'react';
import { AiModeBadge } from './AiModeBadge';
import { ChatIcon, MicIcon } from './icons';
import { getLink, subscribe, unlink } from './link';
import { navigate } from './route';

const UNLINK_WARNING =
  '¿Desvincular este dispositivo del negocio? Tendrás que pedir un código nuevo para volver a conectarlo.';

export function HomeScreen() {
  const link = useSyncExternalStore(subscribe, getLink);

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
