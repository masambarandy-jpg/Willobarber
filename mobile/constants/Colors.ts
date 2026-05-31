export const Colors = {
  // Backgrounds
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceElevated: '#252525',
  surfaceBorder: '#2A2A2A',

  // Brand
  gold: '#C9A84C',
  goldLight: '#E8C96A',
  goldDark: '#A07830',
  goldSubtle: 'rgba(201, 168, 76, 0.12)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#666666',
  textInverse: '#0D0D0D',

  // Status
  success: '#4CAF50',
  successSubtle: 'rgba(76, 175, 80, 0.12)',
  error: '#EF5350',
  errorSubtle: 'rgba(239, 83, 80, 0.12)',
  warning: '#FF9800',
  warningSubtle: 'rgba(255, 152, 0, 0.12)',
  info: '#2196F3',
  infoSubtle: 'rgba(33, 150, 243, 0.12)',

  // Reservation status
  statusPending: '#FF9800',
  statusConfirmed: '#4CAF50',
  statusCompleted: '#2196F3',
  statusCancelled: '#EF5350',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.6)',
} as const;

export type ColorKey = keyof typeof Colors;
