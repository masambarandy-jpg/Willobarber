export * from './Colors';
export * from './Typography';
export * from './Spacing';

export const API_BASE_URL = 'http://192.168.129.7:8000/api';

export const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'en', label: 'English' },
] as const;

export const SERVICE_CATEGORIES = {
  coupe_homme: 'Coupe Homme',
  barbe: 'Barbe',
  package: 'Package',
  coloration: 'Coloration',
  soin: 'Soin',
  enfant: 'Enfant',
} as const;

export const RESERVATION_STATUS = {
  pending: { label: 'En attente', color: '#FF9800' },
  confirmed: { label: 'Confirmé', color: '#4CAF50' },
  completed: { label: 'Terminé', color: '#2196F3' },
  cancelled_client: { label: 'Annulé', color: '#EF5350' },
  cancelled_barber: { label: 'Annulé par barbier', color: '#EF5350' },
  no_show: { label: 'Non présenté', color: '#9E9E9E' },
} as const;
