import { useSyncExternalStore } from 'react';

/**
 * Installing TURA on the home screen. Installed, it opens like any app and —
 * on iPhone above all — the browser keeps its connection: Safari can clear
 * what a site that is only visited keeps after a week without use.
 */

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'tura-install-dismissed';
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Chrome and Edge offer installing once a site qualifies; the offer is kept for the button. Call early. */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** How TURA can be installed here: with a button, by hand on iPhone, or not at all (installed, dismissed, unsupported). */
export type InstallOption = 'prompt' | 'ios' | null;

function currentOption(): InstallOption {
  if (isInstalled() || wasDismissed()) return null;
  if (deferred) return 'prompt';
  return isIos() ? 'ios' : null;
}

export function useInstallOption(): InstallOption {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, currentOption);
}

export async function install(): Promise<void> {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice.catch(() => undefined);
  deferred = null;
  notify();
}

export function dismissInstall(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Without storage the hint comes back next time; nothing else to do.
  }
  notify();
}
