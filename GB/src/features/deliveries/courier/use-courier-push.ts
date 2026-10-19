import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';

/**
 * - unsupported: this browser cannot receive push at all.
 * - needs-install: iPhone/iPad in Safari: push only reaches the app added to the home screen.
 * - server-off: the server has no push keys (the app still alerts while open).
 * - off: can be turned on (asks for permission).
 * - denied: the person blocked notifications; only the browser settings can undo it.
 * - on: this device receives push.
 */
export type PushState = 'loading' | 'unsupported' | 'needs-install' | 'server-off' | 'off' | 'denied' | 'on';

const COURIER_MANIFEST = '/manifest-domiciliario.webmanifest';

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

function urlBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  await apiClient.post('/push/subscriptions', { endpoint: json.endpoint, keys: json.keys });
}

/**
 * The courier app as an installable web app with push notifications: it
 * swaps in the courier's manifest (so "Add to home screen" opens
 * /domiciliario), registers the service worker (GB/public/sw.js) and keeps
 * this device's push subscription saved on the server.
 */
export function useCourierPush(): { state: PushState; enable: () => Promise<void> } {
  const [state, setState] = useState<PushState>('loading');
  const [publicKey, setPublicKey] = useState('');

  // The courier's manifest while this app is open; back to the default on leaving.
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const previous = link.href;
    link.href = COURIER_MANIFEST;
    return () => {
      link.href = previous;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const done = (next: PushState) => {
      if (!cancelled) setState(next);
    };
    (async () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      if (!supported) {
        done(isIos() && !isStandalone() ? 'needs-install' : 'unsupported');
        return;
      }
      if (isIos() && !isStandalone()) {
        done('needs-install');
        return;
      }
      const { data } = await apiClient.get<ApiResponse<{ enabled: boolean; publicKey: string }>>('/push/public-key');
      if (!data.data.enabled) {
        done('server-off');
        return;
      }
      if (!cancelled) setPublicKey(data.data.publicKey);
      const registration = await navigator.serviceWorker.register('/sw.js');
      if (Notification.permission === 'denied') {
        done('denied');
        return;
      }
      const existing = await registration.pushManager.getSubscription();
      if (existing && Notification.permission === 'granted') {
        // Saved again on every opening: the server may have dropped it, or another courier used this phone.
        await saveSubscription(existing);
        done('on');
        return;
      }
      done('off');
    })().catch(() => done('unsupported'));
    return () => {
      cancelled = true;
    };
  }, []);

  /** Must run from a tap: browsers only show the permission prompt for a user gesture. */
  const enable = useCallback(async () => {
    if (!publicKey) return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setState(permission === 'denied' ? 'denied' : 'off');
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(publicKey),
      }));
    await saveSubscription(subscription);
    setState('on');
  }, [publicKey]);

  return { state, enable };
}
