import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AiModeBadge, aiModeKnown, isLinkOptional } from './AiModeBadge';
import { setAIState, useAIState, type AIState } from './ai-state';
import { BackIcon, MicIcon, MicOffIcon } from './icons';
import { getLink } from './link';
import { onboardingOpening, onboardingReply } from './onboarding';
import { navigate } from './route';
import { NotLinkedError, streamChat, type ChatTurn, type PendingChange } from './tura-client';
import { ActionCard, describeChangeOutcome, type ActionOutcome } from './ActionCard';
import {
  canListen,
  say,
  speechLevel,
  speechTrouble,
  startListening,
  type ListenFailure,
} from './voice-recognition';

// Three.js is most of the app's weight and only this screen draws with it,
// so the hologram is fetched when the screen opens rather than with the menu.
const HologramAssistant = lazy(() =>
  import('./HologramAssistant').then((module) => ({ default: module.HologramAssistant })),
);

type MicStatus = 'on' | 'off' | ListenFailure;

/**
 * How long TURA appears to think before a scripted reply. The script answers
 * at once, which would skip the thinking state altogether.
 */
const SCRIPT_PAUSE_MS = 1200;

/**
 * What TURA says aloud when the screen opens: a greeting by name if this app
 * is linked to a business, and otherwise the start of the script that links it.
 */
function opening(): string {
  const link = getLink();
  if (link) {
    return `Hola, ${link.userName}. ¿En qué te ayudo?`;
  }
  return needsLinking() ? onboardingOpening() : '¡Hola! Yo soy Tura. ¿En qué te ayudo?';
}

/**
 * Whether the conversation has to start by linking the app. Not when the
 * service answers without a link — while the AI is simulated, or with a
 * development token — where linking first would only get in the way.
 */
function needsLinking(): boolean {
  return !getLink() && !isLinkOptional();
}

/** The service accepts 40 messages; older turns are dropped well before that. */
const MAX_HISTORY = 20;

const COPY: Record<AIState, { label: string; hint: string }> = {
  idle: { label: 'Háblame', hint: 'Te escucho cuando quieras.' },
  listening: { label: 'Te escucho…', hint: 'Cuando hagas una pausa, te respondo.' },
  thinking: { label: 'Pensando…', hint: 'Dame unos segundos.' },
  answering: { label: 'Respondiendo…', hint: '' },
};

/** What the screen says instead while TURA is not listening. */
const MIC_COPY: Record<Exclude<MicStatus, 'on'>, { label: string; hint: string }> = {
  off: { label: 'Micrófono apagado', hint: 'Toca el micrófono para activarlo.' },
  denied: {
    label: 'Sin permiso de micrófono',
    hint: 'Permite el micrófono en el navegador y toca el botón para reintentar.',
  },
  network: {
    label: 'No pude escucharte',
    hint: 'Falló el reconocimiento de voz. Revisa la conexión y toca el botón para reintentar.',
  },
  unsupported: {
    label: 'Voz no disponible',
    hint: 'Este navegador no reconoce la voz. Prueba con Chrome, o usa el chat.',
  },
};

/**
 * Takes the complete sentences off the front of `text`. A period only ends a
 * sentence when a space follows, so "1.250.000" stays in one piece.
 */
function takeSentences(text: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let rest = text;
  for (;;) {
    const match = /^([\s\S]*?[.!?…:]+)\s+/.exec(rest);
    if (!match) {
      return { sentences, rest };
    }
    sentences.push(match[1]);
    rest = rest.slice(match[0].length);
  }
}

/** Markdown marks and emoji are read aloud literally, so they are left out. */
function speakable(text: string): string {
  return text.replace(/[*_#`>]|\p{Extended_Pictographic}/gu, '').trim();
}

/**
 * The voice conversation. TURA opens it, and from there it rests until it
 * hears the user, listens until they pause and answers aloud. While the app
 * is not linked to a business the answers come from the linking script;
 * once it is, what the user said goes to the same service as the chat and
 * the answer is read as it arrives. Hearing and speaking are done by the browser.
 */
export function VoiceScreen() {
  // Kept in the shared store, which is also what the hologram shows.
  const state = useAIState();
  const setState = setAIState;
  const [listen, setListen] = useState(canListen);
  const [mic, setMic] = useState<MicStatus>(() => (canListen() ? 'on' : 'unsupported'));
  // What the user said in the turn TURA is answering.
  const [question, setQuestion] = useState<{ text: string } | null>(null);
  // The line under the label: what is being heard, done or said right now.
  const [caption, setCaption] = useState(opening);
  const [failure, setFailure] = useState('');
  const history = useRef<ChatTurn[]>([]);
  /** Changes TURA prepared: confirmed with a tap, never by voice (a transcription can be wrong). */
  const [changes, setChanges] = useState<{ action: PendingChange; outcome?: ActionOutcome }[]>([]);

  function settle(action: PendingChange, outcome: ActionOutcome) {
    setChanges((current) =>
      current.map((change) => (change.action.id === action.id ? { ...change, outcome } : change)),
    );
    // TURA hears what became of it on the next turn.
    const said = describeChangeOutcome(action.summary, outcome);
    const last = history.current.at(-1);
    if (last?.role === 'assistant') {
      history.current = [...history.current.slice(0, -1), { ...last, content: `${last.content}\n\n${said}` }];
    } else {
      history.current = [...history.current, { role: 'assistant', content: said }];
    }
  }
  // The microphone stays closed until TURA has said its opening line. The
  // shared state cannot say so by itself: on the first render it still holds
  // whatever it was when the screen was last left.
  const [greeted, setGreeted] = useState(false);

  // TURA only listens at rest and during the user's turn: with the microphone
  // closed while it thinks and talks, it cannot answer its own voice.
  const hearing = listen && greeted && (state === 'idle' || state === 'listening');

  useEffect(() => {
    let silence: (() => void) | undefined;
    let left = false;
    setState('answering');
    // What TURA opens with depends on whether the AI is simulated, which is
    // not known yet if the app was loaded straight into this screen.
    void aiModeKnown.then(() => {
      if (left) {
        return;
      }
      setCaption(opening());
      silence = say(opening(), () => undefined, () => {
        setState('idle');
        setGreeted(true);
      });
    });
    return () => {
      left = true;
      silence?.();
    };
  }, [setState]);

  useEffect(() => {
    if (!hearing) {
      return;
    }
    const listener = startListening({
      onSpeech(partial) {
        setFailure('');
        setCaption(partial);
        setState('listening');
      },
      onPhrase(text) {
        setCaption(text);
        // A new question: the changes already settled leave the screen.
        setChanges((current) => current.filter((change) => !change.outcome));
        setQuestion({ text });
        setState('thinking');
      },
      onFailure(reason) {
        setListen(false);
        setMic(reason);
        setState('idle');
      },
    });
    return () => listener.stop();
  }, [hearing]);

  useEffect(() => {
    if (!question) {
      return;
    }
    const abort = new AbortController();
    const silence: (() => void)[] = [];
    const turns: ChatTurn[] = [...history.current, { role: 'user', content: question.text }];
    let cancelled = false;
    let answer = '';
    let unsaid = '';
    let speaking = 0;
    let received = false;

    const finish = () => {
      if (cancelled || !received || speaking > 0) {
        return;
      }
      // Only what the assistant answered is remembered; the linking script
      // leaves `answer` empty, so a name or a code never reaches the service.
      if (answer) {
        // Trimmed in pairs, so the conversation still starts with the user.
        history.current = [...turns, { role: 'assistant' as const, content: answer }].slice(
          -MAX_HISTORY,
        );
      }
      setQuestion(null);
      setState('idle');
    };

    const sayAloud = (sentence: string) => {
      const text = speakable(sentence);
      if (!text) {
        return;
      }
      speaking += 1;
      silence.push(
        say(
          text,
          () => {
            setState('answering');
            setCaption(text);
          },
          () => {
            speaking -= 1;
            finish();
          },
        ),
      );
    };

    const fail = (message: string) => {
      silence.forEach((stop) => stop());
      setFailure(message);
      setQuestion(null);
      setState('idle');
    };

    void (async () => {
      try {
        if (needsLinking()) {
          const [reply] = await Promise.all([
            onboardingReply(question.text),
            new Promise((resolve) => setTimeout(resolve, SCRIPT_PAUSE_MS)),
          ]);
          if (cancelled) {
            return;
          }
          const { sentences, rest } = takeSentences(reply);
          [...sentences, rest].forEach(sayAloud);
          received = true;
          finish();
          return;
        }
        for await (const event of streamChat(turns, abort.signal, 'voice')) {
          if (cancelled) {
            return;
          }
          if (event.type === 'text') {
            answer += event.delta;
            // Each sentence is said as soon as it is complete, without
            // waiting for the rest of the answer.
            const { sentences, rest } = takeSentences(unsaid + event.delta);
            unsaid = rest;
            sentences.forEach(sayAloud);
          } else if (event.type === 'tool') {
            setCaption('Consultando el POS…');
          } else if (event.type === 'confirm') {
            const action = event.action;
            setChanges((current) => [...current, { action }]);
          } else if (event.type === 'error') {
            cancelled = true;
            fail(event.message);
            return;
          }
        }
        sayAloud(unsaid);
        received = true;
        finish();
      } catch (error) {
        if (!cancelled) {
          cancelled = true;
          fail(
            error instanceof NotLinkedError
              ? 'Este dispositivo ya no está vinculado con el negocio. Háblame para vincularlo de nuevo.'
              : error instanceof Error
                ? error.message
                : 'TURA no está disponible en este momento.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();
      silence.forEach((stop) => stop());
    };
  }, [question]);

  function toggleMic() {
    if (listen) {
      // Also the way to interrupt TURA mid-answer.
      setListen(false);
      setMic('off');
      setQuestion(null);
      setState('idle');
    } else if (canListen()) {
      setFailure('');
      setMic('on');
      setListen(true);
    }
  }

  let copy = COPY[state];
  if (state === 'idle') {
    if (mic !== 'on') {
      copy = MIC_COPY[mic];
    } else if (failure) {
      copy = { label: 'Algo falló', hint: failure };
    }
  } else if (caption) {
    copy = { label: copy.label, hint: state === 'thinking' ? `«${caption}»` : caption };
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
        <h1 className="screen__title">Hablar</h1>
        <AiModeBadge />
      </header>

      <main className="voice" data-state={state}>
        <div className="voice__stage">
          <Suspense fallback={<div className="voice__hologram" />}>
            <HologramAssistant audioLevel={speechLevel} />
          </Suspense>
          <div className="voice__status" aria-live="polite">
            <p className="voice__label">{copy.label}</p>
            <p className="voice__hint">{copy.hint}</p>
          </div>
        </div>

        {changes.length > 0 && (
          <div className="voice__actions">
            {changes.map(({ action }) => (
              <ActionCard key={action.id} action={action} onSettled={(outcome) => settle(action, outcome)} />
            ))}
          </div>
        )}

        <button
          type="button"
          className={mic === 'on' ? 'voice__mic' : 'voice__mic voice__mic--off'}
          aria-label={listen ? 'Apagar el micrófono' : 'Activar el micrófono'}
          disabled={mic === 'unsupported'}
          onClick={toggleMic}
        >
          {mic === 'on' ? <MicIcon /> : <MicOffIcon />}
        </button>

        {/* Read while rendering: it changes with the sentences, which already re-render the screen. */}
        {speechTrouble() && (
          <p className="voice__note">
            El navegador no reprodujo la voz, así que la respuesta solo se muestra. Detalle:{' '}
            {speechTrouble()}.
          </p>
        )}
      </main>
    </div>
  );
}
