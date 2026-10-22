import { env } from '../../config/env';

/**
 * Loads the Maps JavaScript API once, on first use (only Domicilios needs it,
 * so it never weighs on the rest of the app). Routes and address search go
 * to their REST APIs (see routes.ts and places.ts): this project's key has
 * the Routes API and Places API (New), not the legacy Directions/Places
 * services the JavaScript API would call.
 */
let loading: Promise<typeof google.maps> | null = null;

const CALLBACK = '__goldenBitesMapsReady';

export function isGoogleMapsConfigured(): boolean {
  return env.googleMapsApiKey !== '';
}

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (!isGoogleMapsConfigured()) {
    return Promise.reject(new Error('Falta VITE_GOOGLE_MAPS_API_KEY'));
  }
  loading ??= new Promise<typeof google.maps>((resolve, reject) => {
    const callbacks = window as unknown as Record<string, () => void>;
    callbacks[CALLBACK] = () => resolve(google.maps);
    const params = new URLSearchParams({
      key: env.googleMapsApiKey,
      v: 'weekly',
      loading: 'async',
      language: 'es',
      region: 'CO',
      callback: CALLBACK,
    });
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error('No se pudo cargar Google Maps. Revisa la conexión.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
