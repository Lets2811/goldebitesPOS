import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Dónde está un widget en la cuadrícula del panel de Finanzas y cuánto ocupa, en columnas y filas. */
export interface WidgetPlacement {
  /** Identificador del widget (ver WIDGETS en features/finances/dashboard). */
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FinanceDashboardState {
  /** El panel de cada usuario, por su id: qué widgets tiene y cómo los acomodó. */
  layouts: Record<string, WidgetPlacement[]>;
  setLayout: (userId: string, layout: WidgetPlacement[]) => void;
  /** Olvida el panel del usuario, que vuelve al de fábrica. */
  resetLayout: (userId: string) => void;
}

/**
 * El panel de Finanzas que arma cada persona. Se guarda en este navegador: en
 * otro equipo esa persona empieza con el panel de fábrica.
 */
export const useFinanceDashboardStore = create<FinanceDashboardState>()(
  persist(
    (set) => ({
      layouts: {},
      setLayout: (userId, layout) => set((state) => ({ layouts: { ...state.layouts, [userId]: layout } })),
      resetLayout: (userId) =>
        set((state) => {
          const layouts = { ...state.layouts };
          delete layouts[userId];
          return { layouts };
        }),
    }),
    { name: 'gb-finance-dashboard' },
  ),
);
