import { useEffect, useRef, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { MapPin } from 'lucide-react';
import {
  autocompleteAddress,
  getPlace,
  newPlacesSession,
  type Place,
  type PlaceSuggestion,
} from '../../../lib/google-maps/places';
import type { LatLng } from '../../../modules/deliveries/types/delivery.types';

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

interface AddressSearchProps {
  label: string;
  /** What the field shows; kept by the parent so it can prefill it (e.g. from an order). */
  text: string;
  onTextChange: (text: string) => void;
  /** A suggestion was picked: where it is. */
  onPlace: (place: Place) => void;
  /** Suggestions nearest to this first. */
  near: LatLng | null;
  helperText?: string;
  error?: boolean;
}

/** Address search over Google's Places API (New), restricted to Colombia. */
export default function AddressSearch({
  label,
  text,
  onTextChange,
  onPlace,
  near,
  helperText,
  error,
}: AddressSearchProps) {
  const [options, setOptions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const session = useRef(newPlacesSession());
  const nearRef = useRef(near);
  useEffect(() => {
    nearRef.current = near;
  }, [near]);
  /** The text just became a picked suggestion's: nothing to search for. */
  const picked = useRef(false);

  useEffect(() => {
    const input = text.trim();
    if (picked.current) {
      picked.current = false;
      return;
    }
    if (input.length < MIN_CHARS) {
      return;
    }
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      autocompleteAddress(input, session.current, nearRef.current, abort.signal)
        .then((suggestions) => {
          setOptions(suggestions);
          setFailure(null);
        })
        .catch((cause: unknown) => {
          if (!abort.signal.aborted) setFailure(cause instanceof Error ? cause.message : 'Error buscando la dirección');
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      abort.abort();
      window.clearTimeout(timer);
    };
  }, [text]);

  async function pick(suggestion: PlaceSuggestion) {
    try {
      const place = await getPlace(suggestion.placeId, session.current);
      onPlace(place);
      setFailure(null);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'No se pudo ubicar esa dirección');
    } finally {
      // A new search starts a new billing session.
      session.current = newPlacesSession();
    }
  }

  return (
    <Autocomplete<PlaceSuggestion, false, false, true>
      freeSolo
      options={text.trim().length < MIN_CHARS ? [] : options}
      loading={loading}
      filterOptions={(all) => all}
      getOptionLabel={(option) =>
        typeof option === 'string' ? option : [option.primary, option.secondary].filter(Boolean).join(', ')
      }
      inputValue={text}
      onInputChange={(_event, value, reason) => {
        if (reason !== 'reset') onTextChange(value);
      }}
      onChange={(_event, value) => {
        if (value && typeof value !== 'string') {
          picked.current = true;
          onTextChange([value.primary, value.secondary].filter(Boolean).join(', '));
          void pick(value);
        }
      }}
      noOptionsText={text.trim().length < MIN_CHARS ? 'Escribe la dirección' : 'Sin resultados'}
      renderOption={(props, option) => {
        const { key, ...rest } = props as typeof props & { key: string };
        return (
          <Box component="li" key={key} {...rest} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box sx={{ pt: 0.25, color: 'text.secondary' }}>
              <MapPin size={16} />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {option.primary}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {option.secondary}
              </Typography>
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder="Calle, carrera, número o lugar"
          error={error || Boolean(failure)}
          helperText={failure ?? helperText}
        />
      )}
    />
  );
}
