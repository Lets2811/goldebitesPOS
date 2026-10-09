/**
 * Why TURA cannot hear: the browser has no speech recognition (it exists in
 * Chrome, Edge and Safari), the user refused the microphone, or the browser
 * could not reach the service that does the transcription.
 */
export type ListenFailure = 'unsupported' | 'denied' | 'network';

export interface ListenHandlers {
  /** The user is talking; `partial` is what has been understood so far. */
  onSpeech(partial: string): void;
  /** The user paused; `text` is the whole phrase. Listening stops here. */
  onPhrase(text: string): void;
  onFailure(reason: ListenFailure): void;
}

export interface Listener {
  stop(): void;
}

/** The part of the browser's SpeechRecognition this module uses. */
interface Recognizer {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

type RecognizerClass = new () => Recognizer;

function recognizerClass(): RecognizerClass | undefined {
  const scope = window as unknown as {
    SpeechRecognition?: RecognizerClass;
    webkitSpeechRecognition?: RecognizerClass;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

export function canListen(): boolean {
  return recognizerClass() !== undefined;
}

const RESTART_MS = 250;

/**
 * Listens until the user says something and pauses. The browser gives up on
 * its own after a few seconds of silence, so listening is restarted until a
 * phrase arrives or `stop` is called.
 */
export function startListening(handlers: ListenHandlers): Listener {
  const Recognition = recognizerClass();
  if (!Recognition) {
    handlers.onFailure('unsupported');
    return { stop() {} };
  }

  let stopped = false;
  let recognizer: Recognizer | undefined;
  let restart: ReturnType<typeof setTimeout> | undefined;

  const listen = () => {
    let heard = '';
    const current = new Recognition();
    recognizer = current;
    current.lang = 'es-CO';
    current.interimResults = true;

    current.onresult = (event) => {
      heard = Array.from(event.results, (result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (!stopped && heard) {
        handlers.onSpeech(heard);
      }
    };

    current.onerror = (event) => {
      // Silence and our own abort are part of normal operation.
      if (stopped || event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      stopped = true;
      const denied = ['not-allowed', 'service-not-allowed', 'audio-capture'];
      handlers.onFailure(denied.includes(event.error) ? 'denied' : 'network');
    };

    current.onend = () => {
      if (stopped) {
        return;
      }
      if (heard) {
        stopped = true;
        handlers.onPhrase(heard);
      } else {
        restart = setTimeout(listen, RESTART_MS);
      }
    };

    try {
      current.start();
    } catch {
      stopped = true;
      handlers.onFailure('denied');
    }
  };

  listen();

  return {
    stop() {
      stopped = true;
      clearTimeout(restart);
      recognizer?.abort();
    },
  };
}

let speechPrimed = false;

/**
 * Phones only let the page speak if speech was first started from inside a
 * tap. An empty utterance on the first click anywhere does that, so the
 * answers that arrive later on their own are allowed to sound.
 */
function primeSpeech(): void {
  if (!speechPrimed && 'speechSynthesis' in window) {
    speechPrimed = true;
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  }
}

window.addEventListener('click', primeSpeech, { capture: true });

// The browser does not expose the sound of its own speech, only an event at
// the start of each word (and not with every voice). That is what stands in
// for loudness: a beat on every word, fading until the next one.
let wordAt: number | null = null;
const WORD_FADE_MS = 170;

/**
 * How loud TURA's voice is right now, from 0 to 1, for whatever animates
 * along with it. Null while the browser gives nothing to go by.
 */
export function speechLevel(): number | null {
  return wordAt === null ? null : Math.exp(-(performance.now() - wordAt) / WORD_FADE_MS);
}

/** How long a sentence stays on screen when the browser does not speak it. */
const SILENT_MS_PER_CHARACTER = 60;
/** The browser is given this long to start speaking before the sentence goes on without sound. */
const START_TIMEOUT_MS = 2500;
/** The longest a spoken sentence may take: a base plus an allowance per character. */
const speakingLimitMs = (text: string) => 4000 + text.length * 130;

interface Sentence {
  text: string;
  onStart: () => void;
  onEnd: () => void;
  /** Ends whatever this sentence has running; set while it is the one being said. */
  halt?: () => void;
  silenced: boolean;
}

// Sentences are said one at a time from this queue instead of being handed to
// the browser all at once. Its own queue can stall without an error or an
// event (after a cancel, with some voices, on long sentences), and a turn
// that waits on an event that never comes would hang for good.
const waiting: Sentence[] = [];
let current: Sentence | null = null;

function sayNext(): void {
  const sentence = waiting.shift();
  if (current || !sentence) {
    if (sentence) {
      waiting.unshift(sentence);
    }
    return;
  }
  current = sentence;

  let started = false;
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let utterance: SpeechSynthesisUtterance | undefined;

  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    clearTimeout(timer);
    if (utterance) {
      // Cancelling fires the same events as finishing, so they are detached first.
      utterance.onstart = utterance.onboundary = utterance.onend = utterance.onerror = null;
    }
    wordAt = null;
    current = null;
    if (!sentence.silenced) {
      sentence.onEnd();
    }
    sayNext();
  };
  const begin = (limitMs: number) => {
    if (started || finished) {
      return;
    }
    started = true;
    clearTimeout(timer);
    timer = setTimeout(finish, limitMs);
    if (!sentence.silenced) {
      sentence.onStart();
    }
  };
  /** Shown for as long as it would take to read, without sound. */
  const goSilent = () => begin(Math.max(1200, sentence.text.length * SILENT_MS_PER_CHARACTER));

  sentence.halt = () => {
    if (utterance) {
      utterance.onstart = utterance.onboundary = utterance.onend = utterance.onerror = null;
      window.speechSynthesis.cancel();
    }
    finish();
  };

  if (!('speechSynthesis' in window)) {
    goSilent();
    return;
  }

  /** Gives up on sound for this sentence, saying why, and shows it instead. */
  const fallBack = (reason: string) => {
    speechProblem = reason;
    console.warn(`TURA: the sentence is shown without sound (${reason}).`);
    if (utterance) {
      utterance.onstart = utterance.onboundary = utterance.onend = utterance.onerror = null;
    }
    window.speechSynthesis.cancel();
    goSilent();
  };

  /**
   * Hands the sentence to the browser. The first try asks for a Spanish
   * voice by name; if that fails before a word is said, the second leaves
   * the choice of voice to the browser, and after that it is shown in silence.
   */
  const attempt = (pickVoice: boolean) => {
    const spoken = new SpeechSynthesisUtterance(sentence.text);
    utterance = spoken;
    const voice = pickVoice ? maleVoice() : undefined;
    if (voice) {
      spoken.voice = voice;
    }
    spoken.lang = voice?.lang ?? 'es-ES';
    // With no man's voice to choose, a lower pitch is the nearest thing.
    spoken.pitch = voice ? 1 : FALLBACK_PITCH;
    spoken.onstart = () => {
      speechProblem = null;
      begin(speakingLimitMs(sentence.text));
    };
    spoken.onboundary = () => {
      wordAt = performance.now();
    };
    // Ending or failing before it ever started is not having said it.
    const stopped = (reason: string) => {
      if (started) {
        finish();
      } else if (pickVoice) {
        spoken.onstart = spoken.onboundary = spoken.onend = spoken.onerror = null;
        clearTimeout(timer);
        attempt(false);
      } else {
        fallBack(reason);
      }
    };
    spoken.onend = () => stopped('the browser ended it without speaking');
    spoken.onerror = (event) => stopped(`speech error: ${event.error}`);
    // A paused or stalled synthesiser keeps everything after it waiting.
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(spoken);
    timer = setTimeout(() => fallBack('the browser did not start speaking'), START_TIMEOUT_MS);
  };
  attempt(true);
}

/**
 * TURA speaks with a man's voice. Browsers do not say which voices are male,
 * so they are recognised by name, in order of preference: Latin American
 * first (the business is in Colombia), and the natural-sounding ones Edge
 * offers ahead of the plainer ones built into Windows, macOS and iOS.
 * Chrome's own Spanish voices are all female, so there TURA uses whichever
 * of these the operating system has.
 */
const MALE_VOICES = [
  'Gonzalo', // Colombia
  'Jorge', // Mexico
  'Alonso', // United States
  'Raul', // Mexico, Windows
  'Juan', // Mexico on Apple devices, Costa Rica in Edge
  'Carlos',
  'Diego',
  'Tomas',
  'Lorenzo',
  'Álvaro', // Spain
  'Pablo', // Spain, Windows
];
/** How low the default voice is pitched when none of those is installed (1 is normal). */
const FALLBACK_PITCH = 0.7;

function maleVoice(): SpeechSynthesisVoice | undefined {
  const spanish = window.speechSynthesis.getVoices().filter((voice) => voice.lang.startsWith('es'));
  for (const name of MALE_VOICES) {
    const voice = spanish.find((candidate) => candidate.name.includes(name));
    if (voice) {
      return voice;
    }
  }
  return undefined;
}

let speechProblem: string | null = null;
/** Why the last sentence went unspoken, or null if the browser is speaking normally. */
export function speechTrouble(): string | null {
  return speechProblem;
}

/**
 * Says one sentence aloud, after any that are still being said. `onStart`
 * and `onEnd` are always called, in that order, even if the browser never
 * makes a sound: the sentence then stays up for as long as it takes to read.
 * Returns a function that silences the sentence without calling either.
 */
export function say(text: string, onStart: () => void, onEnd: () => void): () => void {
  const sentence: Sentence = { text, onStart, onEnd, silenced: false };
  waiting.push(sentence);
  sayNext();
  return () => {
    sentence.silenced = true;
    const queued = waiting.indexOf(sentence);
    if (queued !== -1) {
      waiting.splice(queued, 1);
    } else if (current === sentence) {
      sentence.halt?.();
    }
  };
}
