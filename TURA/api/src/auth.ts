import type { Request } from 'express';
import { config } from './config.js';
import { PosApiError, PosClient } from './pos/pos-client.js';

/** The claims TURA reads from GB-BE's access token (see JwtPayload in GB-BE). */
interface AccessTokenClaims {
  sub: string | null;
  businessId: string | null;
  branchId: string | null;
  roleName: string;
  permissions: string[];
  /** Set when the token was issued through a user's TURA link rather than by signing in. */
  turaLinkId: string | null;
}

interface PosProfile {
  firstName: string;
  lastName: string;
}

/** Body of GB-BE's /tura-links/me: the user a link acts as, and their business. */
interface LinkIdentity {
  userName: string;
  businessName: string;
}

export interface Session {
  pos: PosClient;
  /** Who is asking, for the audit log. Null only while the AI is simulated and nobody is signed in. */
  userId: string | null;
  businessId: string | null;
  firstName: string;
  /** The user's business, when known: it comes with a TURA link, not with a POS sign-in. */
  businessName: string | null;
  roleName: string;
  branchId: string | null;
  permissions: string[];
}

export class UnauthenticatedError extends Error {}

function decodeClaims(token: string): AccessTokenClaims {
  const payload = token.split('.')[1];
  if (!payload) {
    throw new UnauthenticatedError();
  }
  try {
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf-8'),
    ) as Partial<AccessTokenClaims>;
    return {
      sub: claims.sub ?? null,
      businessId: claims.businessId ?? null,
      branchId: claims.branchId ?? null,
      roleName: claims.roleName ?? '',
      permissions: Array.isArray(claims.permissions) ? claims.permissions : [],
      turaLinkId: claims.turaLinkId ?? null,
    };
  } catch {
    throw new UnauthenticatedError();
  }
}

/**
 * Resolves the caller from their POS access token: normally the one a user's
 * TURA link is exchanged for, which carries that user's role, branch and
 * read-only permissions. TURA does not hold the JWT secret: it asks GB-BE who
 * the token belongs to, and only once GB-BE has accepted it are the token's
 * claims read. Those claims only shape the conversation (which tools are
 * offered); GB-BE still authorizes every individual call.
 */
export async function authenticate(req: Request): Promise<Session> {
  const header = req.headers.authorization ?? '';
  // A linked app sends its own token; the development token only stands in when there is none.
  const token = (header.startsWith('Bearer ') ? header.slice(7).trim() : '') || config.devPosToken;
  if (!token) {
    if (!config.simulateAi) {
      throw new UnauthenticatedError();
    }
    // While the AI is simulated nothing is read from the POS and nothing is
    // spent, so the interface can be tried without linking the app first.
    return {
      pos: new PosClient(''),
      userId: null,
      businessId: null,
      firstName: '',
      businessName: null,
      roleName: '',
      branchId: null,
      permissions: [],
    };
  }

  const pos = new PosClient(token);
  const claims = decodeClaims(token);
  const access = {
    pos,
    userId: claims.sub,
    businessId: claims.businessId,
    roleName: claims.roleName,
    branchId: claims.branchId,
    permissions: claims.permissions,
  };

  try {
    if (claims.turaLinkId) {
      // Asked on every turn, so a link revoked in the POS, a user who was
      // deactivated or a business that lost the module stops working here
      // right away instead of when the access token expires.
      const { data: link } = await pos.get<LinkIdentity>('/tura-links/me');
      return { ...access, firstName: link.userName, businessName: link.businessName };
    }
    const { data: profile } = await pos.get<PosProfile>('/users/me');
    return { ...access, firstName: profile.firstName, businessName: null };
  } catch (error) {
    // GB-BE accepted the token but no longer stands behind it (the link is
    // gone): the app has to link again.
    if (error instanceof PosApiError && error.status === 404) {
      throw new UnauthenticatedError();
    }
    throw error;
  }
}
