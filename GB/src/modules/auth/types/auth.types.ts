/** Session profile returned by /auth/login and /auth/refresh (includes the JWT-derived roleName). */
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
  /**
   * Signed in without a branch yet (someone who may work at every branch, at
   * a business with several): the app shows the branch picker and nothing else.
   */
  branchSelectionRequired?: boolean;
}

/** Full profile returned by GET /users/me. No roleName — fetch the role separately if needed. */
export interface CurrentUserProfile {
  id: string;
  businessId: string;
  branchId: string | null;
  roleId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export type LoginResponseData = AuthTokens & { user: AuthenticatedProfile };
