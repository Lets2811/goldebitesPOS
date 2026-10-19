import { env } from '../../config/env';
import type { LatLng } from './routes';

export interface PlaceSuggestion {
  placeId: string;
  /** Main line, e.g. "Cra. 43A #1-50". */
  primary: string;
  /** The rest, e.g. "El Poblado, Medellín, Antioquia". */
  secondary: string;
}

export interface Place extends LatLng {
  address: string;
}

/**
 * A session groups the keystrokes of one search with the place finally
 * picked, which Google bills as a single search.
 */
export function newPlacesSession(): string {
  return crypto.randomUUID();
}

const headers = (fieldMask?: string): HeadersInit => ({
  'Content-Type': 'application/json',
  'X-Goog-Api-Key': env.googleMapsApiKey,
  ...(fieldMask ? { 'X-Goog-FieldMask': fieldMask } : {}),
});

/** Address suggestions in Colombia, nearest to `near` first. Places API (New). */
export async function autocompleteAddress(
  input: string,
  sessionToken: string,
  near: LatLng | null,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    signal,
    headers: headers(),
    body: JSON.stringify({
      input,
      sessionToken,
      languageCode: 'es',
      includedRegionCodes: ['co'],
      ...(near
        ? {
            locationBias: {
              circle: { center: { latitude: near.latitude, longitude: near.longitude }, radius: 30000 },
            },
            origin: { latitude: near.latitude, longitude: near.longitude },
          }
        : {}),
    }),
  });
  if (!response.ok) {
    throw new Error('No se pudo buscar la dirección.');
  }
  const data = (await response.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        text?: { text: string };
        structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
      };
    }[];
  };
  return (data.suggestions ?? []).flatMap(({ placePrediction: p }) =>
    p
      ? [
          {
            placeId: p.placeId,
            primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
            secondary: p.structuredFormat?.secondaryText?.text ?? '',
          },
        ]
      : [],
  );
}

/** Where a suggested place is, and its full address. Ends the session. */
export async function getPlace(placeId: string, sessionToken: string): Promise<Place> {
  const params = new URLSearchParams({ sessionToken, languageCode: 'es' });
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${params.toString()}`,
    { headers: headers('location,formattedAddress') },
  );
  if (!response.ok) {
    throw new Error('No se pudo ubicar esa dirección.');
  }
  const data = (await response.json()) as {
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
  };
  if (!data.location) {
    throw new Error('Esa dirección no tiene ubicación en el mapa.');
  }
  return {
    address: data.formattedAddress ?? '',
    latitude: data.location.latitude,
    longitude: data.location.longitude,
  };
}
