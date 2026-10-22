import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** A Golden Bites team member signed in to the Admin app. */
export interface AdminProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  mustChangePassword: boolean;
}

export interface AdminSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AdminProfile;
}

interface AdminAuthState {
  user: AdminProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isHydrated: boolean;
  setSession: (session: AdminSession) => void;
  clearSession: () => void;
}

/**
 * The Admin app's session. Its own storage key: a POS session in the same
 * browser (other tab, same machine) is never read or overwritten by it.
 */
export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isHydrated: false,
      setSession: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),
      clearSession: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'gb-admin-session',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken, refreshToken: state.refreshToken }),
    },
  ),
);

useAdminAuthStore.persist.onFinishHydration(() => useAdminAuthStore.setState({ isHydrated: true }));
if (useAdminAuthStore.persist.hasHydrated()) {
  useAdminAuthStore.setState({ isHydrated: true });
}
