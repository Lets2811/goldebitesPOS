/** Tokens de marca Golden Bites: negro profundo, dorado de acento, blanco hueso. */
export const brand = {
  black: '#0B0B0C',
  blackElevated: '#141416',
  blackSurface: '#1A1A1D',
  blackBorder: '#2A2A2E',
  gold: '#D4AF37',
  goldLight: '#E6C868',
  goldDark: '#9C7C22',
  bone: '#F5F1E8',
  boneMuted: '#B9B4A8',
} as const;

export const statusColors = {
  success: '#4CAF6D',
  warning: '#D9A441',
  error: '#D9534F',
  info: '#5B8DBE',
  neutral: '#8A8A8E',
} as const;

/** Paleta categórica fija para gráficas (Recharts). Orden fijo, nunca ciclada por rango. */
export const chartCategorical = [
  brand.gold,
  '#5B8DBE',
  '#4CAF6D',
  '#B979D9',
  '#D97A4C',
  '#5FC6C6',
] as const;

export const chartGrid = brand.blackBorder;
export const chartAxis = brand.boneMuted;
