import { useSyncExternalStore } from 'react';

/**
 * Whether the service answers with the real model or with canned replies
 * (TURA_SIMULATE_AI in TURA/api). `unknown` until the service has said, and
 * whenever it cannot be reached.
 */
type AiMode = 'live' | 'simulated' | 'unknown';

let mode: AiMode = 'unknown';
/** Whether the service answers an app that is not linked: while simulated, or with a development token. */
let linkOptional = false;
const listeners = new Set<() => void>();

async function refresh(): Promise<void> {
  let next: AiMode = 'unknown';
  let nextLinkOptional = false;
  try {
    const response = await fetch('/tura/health');
    if (response.ok) {
      const health = (await response.json()) as { simulated?: boolean; linkRequired?: boolean };
      next = health.simulated ? 'simulated' : 'live';
      nextLinkOptional = health.linkRequired === false || health.simulated === true;
    }
  } catch {
    // Stays unknown: the service is not running or not reachable.
  }
  if (next !== mode || nextLinkOptional !== linkOptional) {
    mode = next;
    linkOptional = nextLinkOptional;
    listeners.forEach((listener) => listener());
  }
}

// The mode only changes when the service is restarted with another setting,
// which happens while the developer is away from this tab.
/** Settles once the service has said (or failed to say) which mode it is in. */
export const aiModeKnown = refresh();
window.addEventListener('focus', () => void refresh());

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const LABELS: Record<AiMode, { text: string; title: string }> = {
  live: { text: 'IA activa', title: 'Las respuestas vienen del modelo y gastan créditos.' },
  simulated: {
    text: 'Simulación',
    title: 'Las respuestas son de ejemplo: no se llama al modelo ni se gastan créditos.',
  },
  unknown: { text: 'Sin servicio', title: 'No se pudo consultar el servicio de TURA.' },
};

/** The same as useAiSimulated, for code that is not a component. */
export function isAiSimulated(): boolean {
  return mode === 'simulated';
}

/** Whether the conversation can start without linking the app first. */
export function isLinkOptional(): boolean {
  return linkOptional;
}

/** The same as isLinkOptional, for components. */
export function useLinkOptional(): boolean {
  return useSyncExternalStore(subscribe, () => linkOptional);
}

/** Whether the service is answering with canned replies, a development setting. */
export function useAiSimulated(): boolean {
  return useSyncExternalStore(subscribe, () => mode) === 'simulated';
}

/** Shown in every screen's header, so it is always clear which mode is answering. */
export function AiModeBadge() {
  const current = useSyncExternalStore(subscribe, () => mode);
  const { text, title } = LABELS[current];

  return (
    <span className={`ai-mode ai-mode--${current}`} title={title}>
      {text}
    </span>
  );
}
