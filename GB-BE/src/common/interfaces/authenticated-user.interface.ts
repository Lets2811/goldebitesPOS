/**
 * Shape attached to `request.user` once a request passes JwtAuthGuard.
 * Populated straight from the JWT payload — no DB round-trip per request.
 */
export interface AuthenticatedUser {
  userId: string;
  businessId: string;
  branchId: string | null;
  roleId: string;
  roleName: string;
  permissions: string[];
  isPlatformAdmin: boolean;
  enabledFeatures: string[];
  mustChangePassword: boolean;
  /** Present when the caller is TURA acting for this user, not the user signed in. */
  turaLinkId?: string;
}
