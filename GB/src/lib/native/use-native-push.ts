import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/api-client';
import type { ApiResponse } from '../api/api-types';
import {
  nativePushPermission,
  onNativeNotificationTapped,
  registerNativePush,
  requestNativePushPermission,
} from './native-push';

/**
 * - loading: still finding out.
 * - server-off: the server has no Firebase (the app still alerts while open).
 * - off: can be turned on (asks for permission, from a tap).
 * - denied: the person said no; only the phone's settings can undo it.
 * - on: this phone receives the notifications.
 */
export type NativePushState = 'loading' | 'server-off' | 'off' | 'denied' | 'on';

/**
 * The installed phone app: the phone's own notifications (Firebase). Asks
 * for the permission from a tap, keeps this phone's token saved on the
 * server, and a tapped notification opens where it leads.
 */
export function useNativePush(): { state: NativePushState; enable: () => Promise<void> } {
  const [state, setState] = useState<NativePushState>('loading');
  const navigate = useNavigate();

  useEffect(() => onNativeNotificationTapped((url) => navigate(url)), [navigate]);

  useEffect(() => {
    let cancelled = false;
    const done = (next: NativePushState) => {
      if (!cancelled) setState(next);
    };
    (async () => {
      const { data } =
        await apiClient.get<ApiResponse<{ nativeEnabled?: boolean }>>('/push/public-key');
      if (!data.data.nativeEnabled) {
        done('server-off');
        return;
      }
      const permission = await nativePushPermission();
      if (permission === 'granted') {
        // Saved again on every opening: the token may change, or another courier used this phone.
        await registerNativePush();
        done('on');
        return;
      }
      done(permission === 'denied' ? 'denied' : 'off');
    })().catch(() => done('server-off'));
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    const permission = await requestNativePushPermission();
    if (permission !== 'granted') {
      setState(permission === 'denied' ? 'denied' : 'off');
      return;
    }
    await registerNativePush();
    setState('on');
  }, []);

  return { state, enable };
}
