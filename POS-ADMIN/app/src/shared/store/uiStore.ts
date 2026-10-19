import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode } from '../theme/theme';

interface UiState {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  themeMode: ThemeMode;
  toggleSidebarCollapsed: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleThemeMode: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      themeMode: 'dark',
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
      toggleThemeMode: () =>
        set((s) => ({ themeMode: s.themeMode === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'gb-ui-preferences',
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, themeMode: s.themeMode }),
    },
  ),
);
