import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { AiModeBadge, useAiSimulated } from './AiModeBadge';
import { BackIcon } from './icons';
import { getLink, subscribe } from './link';
import { onboardingOpening, onboardingReply } from './onboarding';
import { navigate } from './route';
import { NotLinkedError, streamChat, type ChatTurn } from './tura-client';

interface Message {
  id: number;
  role: 'user' | 'assistant' | 'error';
  content: string;
  /**
   * Part of linking the app (the name, the code), handled on this device.
   * It is shown like any other message but never sent to the assistant.
   */
  local?: boolean;
}

const SUGGESTIONS = [
  '¿Cómo va el día?',
  '¿Qué fue lo más vendido esta semana?',
  '¿Qué pedidos están pendientes?',
  '¿Qué insumos están bajos?',
];

/** What to show while TURA waits on each POS tool (names come from TURA/api). */
const TOOL_STATUS: Record<string, string> = {
  resumen_del_dia: 'Revisando el día…',
  consultar_ventas: 'Consultando ventas…',
  listar_pedidos: 'Buscando pedidos…',
  consultar_stock_bajo: 'Revisando inventario…',
};

/** TURA/api accepts at most this many turns; older ones are dropped. */
const MAX_HISTORY = 40;

/** The conversation as TURA/api expects it: text turns only, starting with the user. */
function toHistory(messages: Message[]): ChatTurn[] {
  const turns = messages
    .filter((message) => !message.local && message.role !== 'error' && message.content.trim() !== '')
    .map((message) => ({ role: message.role, content: message.content }) as ChatTurn)
    .slice(-MAX_HISTORY);
  const firstUserTurn = turns.findIndex((turn) => turn.role === 'user');
  return turns.slice(firstUserTurn);
}

export function ChatScreen({ hidden }: { hidden: boolean }) {
  const link = useSyncExternalStore(subscribe, getLink);
  // While the AI is simulated the chat can be tried without linking the app.
  const simulated = useAiSimulated();
  const ready = link !== null || simulated;
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  /** Null when idle; otherwise what TURA is doing right now. */
  const [status, setStatus] = useState<string | null>(null);
  const nextId = useRef(1);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, status, hidden]);

  // Stop an in-flight answer when the screen is torn down.
  useEffect(() => () => abortRef.current?.abort(), []);

  const showError = (content: string) =>
    setMessages((current) => [...current, { id: nextId.current++, role: 'error', content }]);

  /** One step of linking the app: answered by the script, not by the assistant. */
  async function sendToOnboarding(text: string) {
    const local = (role: Message['role'], content: string): Message => ({
      id: nextId.current++,
      role,
      content,
      local: true,
    });
    // TURA's opening line is only on screen as the welcome until the first
    // reply; from then on it has to be part of the conversation.
    const opening = messages.length === 0 ? [local('assistant', onboardingOpening())] : [];
    setMessages((current) => [...current, ...opening, local('user', text)]);
    setDraft('');
    setStatus('');
    try {
      const reply = await onboardingReply(text);
      setMessages((current) => [...current, local('assistant', reply)]);
    } finally {
      setStatus(null);
    }
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || status !== null) {
      return;
    }
    if (!ready) {
      await sendToOnboarding(question);
      return;
    }

    const userMessage: Message = { id: nextId.current++, role: 'user', content: question };
    const answerId = nextId.current++;
    const conversation = [...messages, userMessage];
    setMessages([...conversation, { id: answerId, role: 'assistant', content: '' }]);
    setDraft('');
    setStatus('Pensando…');

    const appendToAnswer = (delta: string) =>
      setMessages((current) =>
        current.map((message) =>
          message.id === answerId ? { ...message, content: message.content + delta } : message,
        ),
      );

    const abort = new AbortController();
    abortRef.current = abort;
    try {
      for await (const event of streamChat(toHistory(conversation), abort.signal)) {
        if (event.type === 'text') {
          setStatus('');
          appendToAnswer(event.delta);
        } else if (event.type === 'tool') {
          setStatus(TOOL_STATUS[event.name] ?? 'Consultando el POS…');
        } else if (event.type === 'error') {
          showError(event.message);
        }
      }
    } catch (cause) {
      if (abort.signal.aborted) {
        return;
      }
      showError(
        cause instanceof NotLinkedError
          ? 'Este dispositivo ya no está vinculado con el negocio. Escríbeme para vincularlo de nuevo.'
          : cause instanceof Error
            ? cause.message
            : 'Ocurrió un error. Intenta de nuevo.',
      );
    } finally {
      // An answer that never produced text would otherwise leave an empty bubble behind.
      setMessages((current) =>
        current.filter((message) => message.id !== answerId || message.content !== ''),
      );
      setStatus(null);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  const busy = status !== null;

  return (
    <div className="screen" hidden={hidden}>
      <header className="screen__header">
        <button
          type="button"
          className="screen__action screen__action--icon"
          aria-label="Volver al menú"
          onClick={() => navigate('home')}
        >
          <BackIcon />
        </button>
        <h1 className="screen__title">Chat</h1>
        <AiModeBadge />
      </header>

      <main className="chat__messages">
        {messages.length > 0 ? (
          messages.map(
            (message) =>
              message.content !== '' && (
                <p key={message.id} className={`bubble bubble--${message.role}`}>
                  {message.content}
                </p>
              ),
          )
        ) : ready ? (
          <section className="chat__welcome">
            <h2>{link ? `Hola, ${link.userName}` : 'Hola'}</h2>
            <p>Pregúntame por las ventas, los pedidos o el inventario.</p>
            <div className="chat__suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => void send(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <p className="bubble bubble--assistant">{onboardingOpening()}</p>
        )}
        {status && (
          <p className="chat__status" role="status">
            {status}
          </p>
        )}
        <div ref={endRef} />
      </main>

      <form className="chat__composer" onSubmit={handleSubmit}>
        <input
          type="text"
          aria-label="Mensaje para TURA"
          placeholder={ready ? 'Pregúntale a TURA' : 'Escribe tu respuesta'}
          enterKeyHint="send"
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="button" disabled={busy || draft.trim() === ''}>
          Enviar
        </button>
      </form>
    </div>
  );
}
