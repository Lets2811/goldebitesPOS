import { Injectable, Logger } from '@nestjs/common';
import { BusinessRuleException } from '../../../common/exceptions';
import {
  MAPS_HOSTS,
  ParsedLocation,
  parseLocationText,
  shortLinkIn,
} from '../domain/parse-location-link';

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 6_000;

/**
 * Turns a location someone shared (a WhatsApp location, a Google Maps or
 * Waze link, coordinates) into a point for the map. Short links
 * (maps.app.goo.gl) are followed here, since a browser cannot read their
 * redirects; only map hosts are ever requested.
 */
@Injectable()
export class DeliveryLocationService {
  private readonly logger = new Logger(DeliveryLocationService.name);

  async resolve(text: string): Promise<ParsedLocation> {
    const direct = parseLocationText(text);
    if (direct) return direct;

    const short = shortLinkIn(text);
    if (short) {
      const followed = await this.follow(short);
      if (followed) return followed;
      throw new BusinessRuleException(
        'Ese enlace no trae una ubicación. Pide al cliente que comparta su ubicación por WhatsApp (Adjuntar → Ubicación).',
        'LOCATION_LINK_EMPTY',
      );
    }
    throw new BusinessRuleException(
      'No encontramos una ubicación ahí. Pega el enlace de la ubicación que te compartieron por WhatsApp o Google Maps.',
      'LOCATION_NOT_FOUND',
    );
  }

  /** Follows the short link hop by hop, reading each address for coordinates. */
  private async follow(start: URL): Promise<ParsedLocation | null> {
    let url = start;
    for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
      if (
        !MAPS_HOSTS.includes(url.hostname.toLowerCase()) ||
        url.protocol !== 'https:'
      ) {
        return null;
      }
      let response: Response;
      try {
        response = await fetch(url, {
          redirect: 'manual',
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: {
            'User-Agent': 'Mozilla/5.0 (GoldenBitesPOS location resolver)',
          },
        });
      } catch (error) {
        this.logger.warn(
          `Could not follow ${url.hostname}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      }
      const location = response.headers.get('location');
      if (!location) {
        return null;
      }
      const next = new URL(location, url);
      const parsed = parseLocationText(next.href);
      if (parsed) return parsed;
      url = next;
    }
    return null;
  }
}
