import type { BranchLocation, LatLng } from '../../modules/deliveries/types/delivery.types';

/** Straight-line distance in meters (haversine), to find the nearest branch. */
export function straightDistance(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export function branchPoint(branch: BranchLocation | undefined): LatLng | null {
  return branch && branch.latitude !== null && branch.longitude !== null
    ? { latitude: branch.latitude, longitude: branch.longitude }
    : null;
}

/** The active, placed branch closest to `point`, or null when none is placed. */
export function nearestBranch(point: LatLng, branches: BranchLocation[]): BranchLocation | null {
  let best: { branch: BranchLocation; distance: number } | null = null;
  for (const branch of branches) {
    const location = branchPoint(branch);
    if (!branch.isActive || !location) continue;
    const distance = straightDistance(point, location);
    if (!best || distance < best.distance) best = { branch, distance };
  }
  return best?.branch ?? null;
}

/** Where this device is, asking the browser (and the person) for it. */
export function currentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Este navegador no permite ubicarte.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      (error) =>
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? 'No diste permiso para usar tu ubicación.'
              : 'No se pudo obtener tu ubicación.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

/** True when the person already allowed location, so asking for it shows no prompt. */
export async function locationAlreadyAllowed(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state === 'granted';
  } catch {
    return false;
  }
}
