export const Colors = {
  // ── Core backgrounds ──────────────────────────
  dark: '#0D0C0A',
  cream: '#F5F0E8',

  // Legacy aliases kept for backward compat
  background: '#0D0C0A',
  surface: '#1A1814',
  surfaceElevated: '#201E19',
  surfaceBorder: 'rgba(255,255,255,0.08)',

  // ── Brand gold ────────────────────────────────
  gold: '#C9A84C',
  goldLight: '#E8CF8A',
  goldDark: '#8B6914',
  goldSubtle: 'rgba(201,168,76,0.12)',
  goldGlow: 'rgba(201,168,76,0.35)',

  // ── Cards ──────────────────────────────────────
  cardDark: '#1A1814',
  cardCream: '#FFFFFF',

  // ── Text ──────────────────────────────────────
  textPrimary: '#FFFFFF',
  textDark: '#1A1208',
  textSecondary: 'rgba(255,255,255,0.55)',
  textGray: '#6B6560',
  textMuted: 'rgba(255,255,255,0.4)',
  textInverse: '#1A1208',

  // ── Status ────────────────────────────────────
  success: '#2D6A4F',
  successLight: '#6fc191',
  successSubtle: '#D4EDDA',
  successText: '#2D6A4F',
  error: '#C0392B',
  errorSubtle: '#FDECEA',
  errorText: '#C0392B',
  warning: '#FF9800',
  warningSubtle: 'rgba(255,152,0,0.12)',
  info: '#2196F3',
  infoSubtle: 'rgba(33,150,243,0.12)',

  // ── Reservation status ────────────────────────
  statusPending: '#FF9800',
  statusConfirmed: '#2D6A4F',
  statusCompleted: '#2196F3',
  statusCancelled: '#C0392B',

  // ── Misc ──────────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(0,0,0,0.7)',
} as const;

export type ColorKey = keyof typeof Colors;
