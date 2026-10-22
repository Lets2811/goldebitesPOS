import { useEffect, useRef, useState } from 'react';
import { deliveriesApi } from '../../modules/deliveries/api/deliveries.api';
import type { CourierPosition, LatLng } from '../../modules/deliveries/types/delivery.types';
import { isNativeApp } from '../../lib/native/platform';
import { reportPositionNatively, watchNativePosition } from '../../lib/native/native-location';
import { straightDistance } from './geo';

/** Report at most this often... */
const MIN_INTERVAL_MS = 8_000;
/** ...unless the courier has not moved, then this often (so the admin sees they are alive). */
const IDLE_INTERVAL_MS = 45_000;
const MIN_MOVE_METERS = 15;

export type LocationStatus = 'off' | 'waiting' | 'on' | 'denied' | 'unavailable';

interface Fix {
  point: LatLng;
  accuracy: number;
  heading: number | null;
  speed: number | null;
}

/**
 * In the installed app, through the phone's own connection (it keeps
 * arriving in the background); if that fails, as the web app does (which
 * renews an expired session).
 */
function sendPosition(position: CourierPosition): Promise<void> {
  if (!isNativeApp) return deliveriesApi.reportPosition(position);
  return reportPositionNatively(position).catch(() => deliveriesApi.reportPosition(position));
}

/**
 * While `enabled`, follows this phone's position and reports it to the POS,
 * which shows it to the admin and to the customer.
 * - In the browser it also keeps the screen awake: a browser stops reporting
 *   when the phone locks or the app goes to the background, so the courier
 *   keeps this screen open while riding.
 * - The installed app reports with the phone locked too (the phone shows a
 *   notification while it does).
 */
export function useCourierLocation(enabled: boolean): { position: LatLng | null; status: LocationStatus } {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<LocationStatus>('off');
  const lastSent = useRef<{ at: number; point: LatLng } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const onFix = ({ point, accuracy, heading, speed }: Fix) => {
      setPosition(point);
      setStatus('on');
      const now = Date.now();
      const last = lastSent.current;
      const moved = last ? straightDistance(last.point, point) : Infinity;
      const due = !last || (moved >= MIN_MOVE_METERS && now - last.at >= MIN_INTERVAL_MS) || now - last.at >= IDLE_INTERVAL_MS;
      if (!due) return;
      lastSent.current = { at: now, point };
      void sendPosition({
        ...point,
        accuracyMeters: Math.round(accuracy),
        heading: heading === null || Number.isNaN(heading) ? null : Math.round(heading),
        speedMps: speed === null ? null : Math.round(speed * 100) / 100,
      }).catch(() => {
        // Retried with the next position.
        lastSent.current = null;
      });
    };

    if (isNativeApp) {
      queueMicrotask(() => setStatus('waiting'));
      let stop: (() => void) | null = null;
      let cancelled = false;
      watchNativePosition(
        (fix) =>
          onFix({
            point: { latitude: fix.latitude, longitude: fix.longitude },
            accuracy: fix.accuracy,
            heading: fix.bearing,
            speed: fix.speed,
          }),
        setStatus,
      )
        .then((stopWatching) => {
          if (cancelled) stopWatching();
          else stop = stopWatching;
        })
        .catch(() => setStatus('unavailable'));
      return () => {
        cancelled = true;
        stop?.();
        setStatus('off');
      };
    }

    if (!('geolocation' in navigator)) {
      queueMicrotask(() => setStatus('unavailable'));
      return;
    }
    queueMicrotask(() => setStatus('waiting'));

    const watchId = navigator.geolocation.watchPosition(
      (geo) =>
        onFix({
          point: { latitude: geo.coords.latitude, longitude: geo.coords.longitude },
          accuracy: geo.coords.accuracy,
          heading: geo.coords.heading,
          speed: geo.coords.speed,
        }),
      (error) => setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 },
    );

    let wakeLock: WakeLockSentinel | null = null;
    const keepAwake = () => {
      if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      navigator.wakeLock
        .request('screen')
        .then((lock) => {
          wakeLock = lock;
        })
        .catch(() => {});
    };
    keepAwake();
    document.addEventListener('visibilitychange', keepAwake);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      document.removeEventListener('visibilitychange', keepAwake);
      void wakeLock?.release().catch(() => {});
      setStatus('off');
    };
  }, [enabled]);

  return { position, status };
}
