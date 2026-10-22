import { useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { brand } from '../../../theme/palette';
import { isGoogleMapsConfigured, loadGoogleMaps } from '../../../lib/google-maps/load-google-maps';
import type { LatLng } from '../../../modules/deliveries/types/delivery.types';

/** Medellín, for a map with nothing on it yet. */
const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 6.2442, lng: -75.5812 };
const ROUTE_COLOR = '#5B8DBE';

const toLiteral = (point: LatLng): google.maps.LatLngLiteral => ({ lat: point.latitude, lng: point.longitude });
const fromLatLng = (point: google.maps.LatLng): LatLng => ({ latitude: point.lat(), longitude: point.lng() });

function pin(color: string): google.maps.Symbol & { labelOrigin: google.maps.Point } {
  return {
    path: 'M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z',
    fillColor: color,
    fillOpacity: 1,
    strokeColor: brand.black,
    strokeWeight: 1.5,
    scale: 1.3,
    anchor: new google.maps.Point(12, 36),
    labelOrigin: new google.maps.Point(12, 12),
  } as google.maps.Symbol & { labelOrigin: google.maps.Point };
}

interface DeliveryMapProps {
  /** Point A. */
  origin: LatLng | null;
  /** Point B. */
  destination?: LatLng | null;
  /** The road path between them, when there is one. */
  path?: google.maps.LatLngLiteral[];
  onOriginChange?: (point: LatLng) => void;
  onDestinationChange?: (point: LatLng) => void;
  /** A click on the map, e.g. to drop point B where there is none yet. */
  onMapClick?: (point: LatLng) => void;
  /** More points: couriers where they are, other deliveries' destinations... */
  markers?: MapMarker[];
  /** Paths already ridden, drawn dashed. */
  trails?: LatLng[][];
  /**
   * The view fits what it shows when A, B or the route change. Markers that
   * move (a courier riding) do not refit it, or it would jump under the
   * user's finger; change this key to refit (e.g. when the couriers change).
   */
  fitKey?: string;
  height?: number | string;
}

export interface MapMarker {
  id: string;
  position: LatLng;
  /** One or two characters drawn on it (initials). */
  label: string;
  title?: string;
  color?: string;
}

const MARKER_COLOR = '#5B8DBE';

/**
 * Google map with point A (gold) and point B (bone), both draggable when a
 * handler is given, and the route between them. It fits the view to what it
 * shows whenever the points move by something other than a drag.
 */
export default function DeliveryMap({
  origin,
  destination = null,
  path,
  onOriginChange,
  onDestinationChange,
  onMapClick,
  markers,
  trails,
  fitKey,
  height = 480,
}: DeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const originMarker = useRef<google.maps.Marker | null>(null);
  const destinationMarker = useRef<google.maps.Marker | null>(null);
  const routeLine = useRef<google.maps.Polyline | null>(null);
  const extraMarkers = useRef(new Map<string, google.maps.Marker>());
  const trailLines = useRef<google.maps.Polyline[]>([]);
  const markersRef = useRef(markers);
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);
  // Handlers change every render; the map listeners read the latest ones.
  const handlers = useRef({ onOriginChange, onDestinationChange, onMapClick });
  useEffect(() => {
    handlers.current = { onOriginChange, onDestinationChange, onMapClick };
  });
  /** Set while a marker is dragged, so the view does not jump after the drop. */
  const dragging = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(
    isGoogleMapsConfigured() ? null : 'Falta configurar la key de Google Maps (VITE_GOOGLE_MAPS_API_KEY).',
  );

  useEffect(() => {
    if (!isGoogleMapsConfigured()) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        const map = new maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 13,
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          gestureHandling: 'greedy',
        });
        map.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (event.latLng) handlers.current.onMapClick?.(fromLatLng(event.latLng));
        });

        const makeMarker = (label: string, color: string, onDrop: (point: LatLng) => void) => {
          const marker = new maps.Marker({
            map,
            icon: pin(color),
            label: { text: label, color: brand.black, fontWeight: '700', fontSize: '13px' },
            visible: false,
          });
          marker.addListener('dragstart', () => {
            dragging.current = true;
          });
          marker.addListener('dragend', () => {
            const position = marker.getPosition();
            if (position) onDrop(fromLatLng(position));
          });
          return marker;
        };
        originMarker.current = makeMarker('A', brand.gold, (point) => handlers.current.onOriginChange?.(point));
        destinationMarker.current = makeMarker('B', brand.bone, (point) =>
          handlers.current.onDestinationChange?.(point),
        );
        routeLine.current = new maps.Polyline({
          map,
          strokeColor: ROUTE_COLOR,
          strokeOpacity: 0.9,
          strokeWeight: 5,
        });
        mapRef.current = map;
        setReady(true);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el mapa.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Markers follow the props.
  useEffect(() => {
    if (!ready) return;
    const place = (marker: google.maps.Marker | null, point: LatLng | null, draggable: boolean) => {
      if (!marker) return;
      marker.setVisible(point !== null);
      marker.setDraggable(draggable);
      if (point) marker.setPosition(toLiteral(point));
    };
    place(originMarker.current, origin, Boolean(onOriginChange));
    place(destinationMarker.current, destination, Boolean(onDestinationChange));
  }, [ready, origin, destination, onOriginChange, onDestinationChange]);

  useEffect(() => {
    if (ready) routeLine.current?.setPath(path ?? []);
  }, [ready, path]);

  // Extra markers, kept by id so a moving courier glides instead of blinking.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const live = extraMarkers.current;
    const wanted = new Set((markers ?? []).map((m) => m.id));
    for (const [id, marker] of live) {
      if (!wanted.has(id)) {
        marker.setMap(null);
        live.delete(id);
      }
    }
    for (const m of markers ?? []) {
      const icon: google.maps.Symbol = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 13,
        fillColor: m.color ?? MARKER_COLOR,
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
      };
      const label = { text: m.label, color: '#FFFFFF', fontWeight: '700', fontSize: '11px' };
      const existing = live.get(m.id);
      if (existing) {
        existing.setPosition(toLiteral(m.position));
        existing.setTitle(m.title ?? null);
        existing.setLabel(label);
      } else {
        live.set(
          m.id,
          new google.maps.Marker({ map, position: toLiteral(m.position), icon, label, title: m.title, zIndex: 10 }),
        );
      }
    }
  }, [ready, markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    trailLines.current.forEach((line) => line.setMap(null));
    trailLines.current = (trails ?? [])
      .filter((trail) => trail.length > 1)
      .map(
        (trail) =>
          new google.maps.Polyline({
            map,
            path: trail.map(toLiteral),
            strokeOpacity: 0,
            icons: [
              {
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeColor: MARKER_COLOR, scale: 3 },
                offset: '0',
                repeat: '12px',
              },
            ],
          }),
      );
  }, [ready, trails]);

  // Fit the view to the points (and the route), except right after a drag.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (dragging.current) {
      dragging.current = false;
      return;
    }
    const points = [origin, destination, ...(markersRef.current ?? []).map((m) => m.position)]
      .filter((p): p is LatLng => p !== null)
      .map(toLiteral);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.panTo(points[0]);
      map.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    [...points, ...(path ?? [])].forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 56);
  }, [ready, origin, destination, path, fitKey]);

  return (
    <Box
      sx={{
        position: 'relative',
        height,
        borderRadius: 2,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
      }}
    >
      <Box ref={containerRef} sx={{ position: 'absolute', inset: 0 }} />
      {!ready && !error && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      )}
      {error && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 2 }}>
          <Alert severity="warning">{error}</Alert>
        </Box>
      )}
    </Box>
  );
}
