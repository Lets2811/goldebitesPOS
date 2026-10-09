import { useSyncExternalStore } from 'react';

/** What TURA is doing, which is what its hologram shows. */
export type AIState = 'idle' | 'listening' | 'thinking' | 'answering';

let current: AIState = 'idle';
const listeners = new Set<() => void>();

/** Changes what TURA is doing, from anywhere in the app. */
export function setAIState(next: AIState): void {
  if (next !== current) {
    current = next;
    listeners.forEach((listener) => listener());
  }
}

export function getAIState(): AIState {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAIState(): AIState {
  return useSyncExternalStore(subscribe, getAIState);
}
