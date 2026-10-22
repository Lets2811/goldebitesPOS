import type { PluginListenerHandle } from '@capacitor/core';
import { PushNotifications, type Channel } from '@capacitor/push-notifications';
import { apiClient } from '../api/api-client';
import { env, type PhoneApp } from '../../config/env';
import { nativePlatform } from './platform';

/** This phone's Firebase token, to stop the notifications on signing out. */
const TOKEN_KEY = 'gb-native-push-token';

/**
 * How the phone rings for each kind of notification (Android), per app. The
 * ids are the ones the server sends with (GB-BE push-notifications.service.ts,
 * androidChannelFor). Importance 5: sound and on top of the screen.
 */
const CHANNELS: Record<PhoneApp, Channel[]> = {
  waiter: [
    {
      id: 'tables',
      name: 'Mesas que piden ayuda',
      description: 'Cuando una mesa llama al mesero desde su menú',
      importance: 5,
      visibility: 1,
      vibration: true,
    },
  ],
  courier: [
    {
      id: 'calls',
      name: 'Llamadas',
      description: 'Cuando el restaurante o el cliente te llama',
      importance: 5,
      visibility: 1,
      vibration: true,
    },
    {
      id: 'deliveries',
      name: 'Domicilios asignados',
      description: 'Cuando te asignan un domicilio',
      importance: 5,
      visibility: 1,
      vibration: true,
    },
    {
      id: 'messages',
      name: 'Mensajes',
      description: 'El chat con el cliente y el restaurante',
      importance: 4,
      visibility: 1,
      vibration: true,
    },
  ],
};

export type NativePushPermission = 'granted' | 'denied' | 'prompt';

function toPermission(receive: string): NativePushPermission {
  if (receive === 'granted') return 'granted';
  return receive === 'denied' ? 'denied' : 'prompt';
}

export async function nativePushPermission(): Promise<NativePushPermission> {
  return toPermission((await PushNotifications.checkPermissions()).receive);
}

/** Shows the phone's prompt (once: after a "no", only the phone's settings can change it). */
export async function requestNativePushPermission(): Promise<NativePushPermission> {
  return toPermission((await PushNotifications.requestPermissions()).receive);
}

/** Registers this phone with Firebase and waits for its token. */
function nextToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const handles: Promise<PluginListenerHandle>[] = [];
    const finish = () => handles.forEach((handle) => void handle.then((h) => h.remove()));
    handles.push(
      PushNotifications.addListener('registration', ({ value }) => {
        finish();
        resolve(value);
      }),
      PushNotifications.addListener('registrationError', ({ error }) => {
        finish();
        reject(new Error(error));
      }),
    );
    PushNotifications.register().catch((error: unknown) => {
      finish();
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

/**
 * This phone receives the signed-in user's notifications. Run on every
 * opening once allowed: the token can change, and another user may have
 * signed in on this phone.
 */
export async function registerNativePush(): Promise<void> {
  const platform = nativePlatform();
  if (!platform) return;
  if (platform === 'android') {
    const channels = env.phoneApp ? CHANNELS[env.phoneApp] : [];
    await Promise.all(channels.map((channel) => PushNotifications.createChannel(channel)));
  }
  const token = await nextToken();
  await apiClient.post('/push/native-tokens', { token, platform });
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Without storage the token is only moved when another user signs in here.
  }
}

/** On signing out: this phone stops receiving that user's notifications. Best-effort. */
export async function forgetNativePush(): Promise<void> {
  let token: string | null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    return;
  }
  if (!token) return;
  await apiClient.delete('/push/native-tokens', { data: { token } }).catch(() => {});
}

/** A notification was tapped: `onTap` gets where it leads (an address of the app). */
export function onNativeNotificationTapped(onTap: (url: string) => void): () => void {
  const handle = PushNotifications.addListener(
    'pushNotificationActionPerformed',
    ({ notification }) => {
      const url = (notification.data as { url?: unknown } | undefined)?.url;
      if (typeof url === 'string' && url.startsWith('/')) onTap(url);
    },
  );
  return () => void handle.then((h) => h.remove());
}
