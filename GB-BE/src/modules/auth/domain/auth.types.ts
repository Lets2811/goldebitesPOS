export interface JwtPayload {
  sub: string;
  businessId: string;
  branchId: string | null;
  roleId: string;
  roleName: string;
  permissions: string[];
  isPlatformAdmin: boolean;
  enabledFeatures: string[];
  mustChangePassword: boolean;
  /**
   * Set on the tokens TURA (the assistant) gets through a user's link, and
   * absent from the ones a user gets by signing in. See the tura-links module.
   */
  turaLinkId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthenticatedProfile {
  id: string;
  businessId: string;
  branchId: string | null;
  roleId: string;
  roleName: string;
  firstName: string;
  lastName: string;
  email: string;
  mustChangePassword: boolean;
}
