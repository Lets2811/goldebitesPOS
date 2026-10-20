export interface JwtPayload {
  sub: string;
  businessId: string;
  branchId: string | null;
  roleId: string;
  roleName: string;
  permissions: string[];
  enabledFeatures: string[];
  mustChangePassword: boolean;
  /**
   * A user who may work at every branch (branches.switch), at a business with
   * several, signs in without one: the app asks which first, and the API
   * refuses the rest until then (BranchScopeGuard).
   */
  branchSelectionRequired?: boolean;
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
  branchSelectionRequired: boolean;
}

/**
 * The branch a session was taken to (switch-branch): one branch, or all of
 * them (branchId null). Kept on the refresh token so a renewal stays there.
 */
export interface BranchSelection {
  branchId: string | null;
}
