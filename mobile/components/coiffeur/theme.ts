export const CC = {
  cream: '#FAF7F1',
  gold: '#C9A84C',
  goldDark: '#8B6914',
  black: '#1a1208',
  cardBlack: '#0D0C0A',
  white: '#FFFFFF',
  successBg: '#D4EDDA',
  successText: '#1E7045',
  errorBg: '#FDECEA',
  errorText: '#C0392B',
  grayBg: '#ECE9E3',
  grayText: '#8A847C',
  vipBg: '#C9A84C',
  vipText: '#FFFFFF',
  border: 'rgba(0,0,0,0.06)',
  textSecondary: '#8a847c',
  inputBorder: '#E0D9CE',
  trackBg: '#f0eadf',
  barTrackBg: '#ece4d3',
} as const;

export type AvatarKey = 'A' | 'K' | 'L' | 'N' | 'T' | 'M' | 'W' | 'I';

export const AVATAR_COLORS: Record<AvatarKey, { bg: string; ring: string }> = {
  A: { bg: '#3a2f12', ring: '#C9A84C' },
  K: { bg: '#3a281b', ring: '#8a5a35' },
  L: { bg: '#1d3328', ring: '#2D6A4F' },
  N: { bg: '#2c2340', ring: '#6b4fa0' },
  T: { bg: '#1d3328', ring: '#2D6A4F' },
  M: { bg: '#3a281b', ring: '#8a5a35' },
  W: { bg: '#3a2f12', ring: '#C9A84C' },
  I: { bg: '#1d3328', ring: '#2D6A4F' },
};

export const SERIF = 'serif';
