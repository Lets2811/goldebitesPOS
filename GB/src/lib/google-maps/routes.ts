import { env } from '../../config/env';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Route {
  distanceMeters: number;
  durationSeconds: number;
  /** The road path, to draw on the map. */
  path: google.maps.LatLngLiteral[];
}

/** Decodes Google's encoded polyline format into points. */
export function decodePolyline(encoded: string): google.maps.LatLngLiteral[] {
  const points: google.maps.LatLngLiteral[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

const toWaypoint = (point: LatLng) => ({
  location: { latLng: { latitude: point.latitude, longitude: point.longitude } },
});

/**
 * The route by road between two points, from the Routes API. By car: Google
 * has no motorcycle routes (TWO_WHEELER) in Colombia, and a car's route is a
 * fair measure of what a motorcycle rides.
 */
export async function computeRoute(origin: LatLng, destination: LatLng, signal?: AbortSignal): Promise<Route> {
  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.googleMapsApiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
    },
    body: JSON.stringify({
      origin: toWaypoint(origin),
      destination: toWaypoint(destination),
      travelMode: 'DRIVE',
      languageCode: 'es-CO',
      units: 'METRIC',
    }),
  });
  if (!response.ok) {
    throw new Error('No se pudo calcular la ruta. Intenta de nuevo.');
  }
  const data = (await response.json()) as {
    routes?: { distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }[];
  };
  const route = data.routes?.[0];
  if (!route) {
    throw new Error('No se encontró una ruta entre los dos puntos.');
  }
  return {
    distanceMeters: route.distanceMeters ?? 0,
    durationSeconds: Number.parseInt(route.duration ?? '0', 10),
    path: route.polyline?.encodedPolyline ? decodePolyline(route.polyline.encodedPolyline) : [],
  };
}
