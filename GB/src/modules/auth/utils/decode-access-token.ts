/**
 * Decodes the payload of the access token to read its permission list.
 *
 * The backend has no "my permissions" endpoint reachable by a regular user
 * (GET /permissions and GET /roles/:id both require `roles.manage`) — the
 * permission codes only travel inside the signed JWT payload. This performs
 * no signature verification, which is fine here: it is used purely to drive
 * UI gating (show/hide), while every write still goes through the backend's
 * PermissionsGuard, which is the real enforcement point.
 */
export interface AccessTokenPayload {
  sub: string;
  businessId: string;
  branchId: string | null;
  roleId: string;
  roleName: string;
  permissions: string[];
  enabledFeatures: string[];
}

export function decodeAccessToken(token: string): AccessTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64url)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(json) as AccessTokenPayload;
  } catch {
    return null;
  }
}
