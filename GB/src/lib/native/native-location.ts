import { CapacitorHttp, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import { env } from '../../config/env';
import { useAuthStore } from '../../modules/auth/store/auth.store';
import type { CourierPosition } from '../../modules/deliveries/types/delivery.types';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export interface NativeFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  /** Degrees from north; null when not moving. */
  bearing: number | null;
  /** Meters per second; null when unknown. */
  speed: number | null;
}

/**
 * Follows the phone's position the phone's way: it keeps going with the
 * phone locked or another app open, showing a notification while it does
 * (Android asks for it). The first time it asks for the location permission.
 * Returns how to stop.
 */
export async function watchNativePosition(
  onFix: (fix: NativeFix) => void,
  onError: (reason: 'denied' | 'unavailable') => void,
): Promise<() => void> {
  const id = await BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: 'Compartiendo tu ubicación',
      backgroundMessage: 'El restaurante y el cliente ven por dónde va el domicilio.',
      requestPermissions: true,
      stale: false,
      distanceFilter: 10,
    },
    (location, error) => {
      if (error) {
        onError(error.code === 'NOT_AUTHORIZED' ? 'denied' : 'unavailable');
        return;
      }
      if (!location) return;
      onFix({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        bearing: location.bearing,
        speed: location.speed,
      });
    },
  );
  return () => void BackgroundGeolocation.removeWatcher({ id });
}

/** The phone's settings for this app, to allow the location after a "no". */
export function openNativeAppSettings(): Promise<void> {
  return BackgroundGeolocation.openSettings();
}

/**
 * Sends the position through the phone's own connection: Android slows down
 * what the app's web view sends while in the background, and the position
 * must keep arriving with the phone locked. Throws when it did not arrive.
 */
export async function reportPositionNatively(position: CourierPosition): Promise<void> {
  const { accessToken } = useAuthStore.getState();
  const response = await CapacitorHttp.post({
    url: new URL(`${env.apiBaseUrl}/deliveries/mine/position`, window.location.href).href,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    data: position,
  });
  if (response.status >= 400) throw new Error(`Position not saved (${response.status})`);
}
