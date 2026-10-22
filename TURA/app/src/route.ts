import { useSyncExternalStore } from 'react';

export type Route = 'home' | 'chat' | 'voice';

const ROUTES: Route[] = ['home', 'chat', 'voice'];

function currentRoute(): Route {
  const hash = window.location.hash.slice(1) as Route;
  return ROUTES.includes(hash) ? hash : 'home';
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

/**
 * The current screen, kept in the URL hash so the phone's back button (and
 * the back gesture) returns to the menu instead of leaving the app.
 */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, currentRoute);
}

export function navigate(route: Route): void {
  window.location.hash = route === 'home' ? '' : route;
}
