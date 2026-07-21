// ─── Types ───────────────────────────────────────────────────────────────────

export interface StaticService {
  id: string;
  cat: string;
  name: string;
  desc: string;
  dur: string;
  price: number;
  popular?: boolean;
  counter?: boolean;
  photo?: string;
}

export interface StaticBarber {
  id: string;
  initial: string;
  name: string;
  role: string;
  roleShort: string;
  avatarColor: string;
  rating: string;
  reviews: number;
  desc: string;
}

export type PaymentMethod = 'card' | 'apple' | 'google';
export type AmountChoice = 'deposit' | 'full';

export interface CardForm {
  prenom: string;
  nom: string;
  email: string;
  phone: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
}

export interface BookingState {
  service: StaticService | null;
  childCount: number;
  barber: StaticBarber | null;
  date: Date | null;
  time: string | null;
}

export interface SlotGroup {
  label: string;
  slots: string[];
}

// ─── Static data ──────────────────────────────────────────────────────────────

export const SERVICES: StaticService[] = [
  {
    id: 'signature',
    cat: 'COUPE HOMME',
    name: 'Signature WilloBarber',
    desc: 'Diagnostic capillaire, shampooing tonique, coupe ciseaux & finition rasoir.',
    dur: '45 min',
    price: 45,
    popular: true,
    photo: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80',
  },
  {
    id: 'barbe',
    cat: 'BARBE',
    name: "Taille & rasage à l'ancienne",
    desc: 'Serviette chaude, huile pré-rasage, rasoir droit.',
    dur: '30 min',
    price: 28,
    photo: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&q=80',
  },
  {
    id: 'rituel',
    cat: 'PACKAGE',
    name: 'Le Rituel',
    desc: 'Coupe signature + barbe + soin du visage. 1h15 hors du monde.',
    dur: '1h15',
    price: 75,
    popular: true,
    photo: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80',
  },
  {
    id: 'express',
    cat: 'COUPE HOMME',
    name: 'Coupe express',
    desc: 'Pour les habitués pressés. Le savoir-faire, version concentrée.',
    dur: '25 min',
    price: 28,
    photo: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&q=80',
  },
  {
    id: 'camouflage',
    cat: 'COLORATION',
    name: 'Camouflage gris',
    desc: 'Pigmentation sur-mesure, sans ammoniaque. Discret. Naturel. Efficace.',
    dur: '40 min',
    price: 35,
    photo: 'https://images.unsplash.com/photo-1518710843675-2540dd79065c?w=800&q=80',
  },
  {
    id: 'soin',
    cat: 'SOIN',
    name: 'Soin du visage',
    desc: "Gommage, masque à l'argile, modelage.",
    dur: '30 min',
    price: 32,
    photo: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80',
  },
  {
    id: 'enfant-15',
    cat: 'ENFANT',
    name: 'Coupe enfant −15 ans',
    desc: 'Coupe adaptée, ambiance détendue.',
    dur: '25 min',
    price: 15,
    counter: true,
    photo: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
  },
  {
    id: 'enfant+15',
    cat: 'ENFANT',
    name: 'Coupe enfant +15 ans',
    desc: 'Coupe ado & jeune adulte, finitions précises au style du moment.',
    dur: '30 min',
    price: 20,
    counter: true,
    photo: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
  },
];

export const BARBERS: StaticBarber[] = [
  {
    id: 'willo',
    initial: 'W',
    name: 'Willo',
    role: 'FONDATEUR & MASTER BARBER',
    roleShort: 'FONDATEUR',
    avatarColor: '#C9A84C',
    rating: '4,9',
    reviews: 312,
    desc: "30 ans de passion pour la coiffure, dont 10 ans d'excellence.",
  },
  {
    id: 'malik',
    initial: 'M',
    name: 'Malik',
    role: 'BARBIER SENIOR',
    roleShort: 'SENIOR',
    avatarColor: '#7A3B1E',
    rating: '4,9',
    reviews: 184,
    desc: "L'œil pour la barbe ciselée. Précis, rapide, efficace.",
  },
  {
    id: 'idris',
    initial: 'I',
    name: 'Idris',
    role: 'BARBIER & COLORISTE',
    roleShort: 'COLORISTE',
    avatarColor: '#1A6B4A',
    rating: '4,8',
    reviews: 96,
    desc: "La relève. Passionné de coupes classiques et de rasage à l'ancienne.",
  },
];

export const SLOT_GROUPS: SlotGroup[] = [
  {
    label: 'MATINÉE',
    slots: ['11:00', '11:30', '12:00', '12:30'],
  },
  {
    label: 'APRÈS-MIDI',
    slots: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'],
  },
  {
    label: 'SOIRÉE',
    slots: ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'],
  },
];

export const LOYALTY_DISCOUNT = 5;

export const ACOMPTE_FIXE = 5;

const CLOSING_MINUTES = 20 * 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JOURS_FR   = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MOIS_FR    = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_SHORT = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
const JOURS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

export function formatDateFr(date: Date): string {
  return `${JOURS_FR[date.getDay()]} ${date.getDate()} ${MOIS_FR[date.getMonth()]}`;
}

export function formatSlot(slot: string): string {
  return slot.replace(':', 'h');
}

export function formatDateTimeFr(date: Date, slot: string): string {
  return `${formatDateFr(date)} · ${formatSlot(slot)}`;
}

export function formatDateShortFr(date: Date): string {
  const j = JOURS_SHORT[date.getDay()];
  const d = date.getDate();
  const m = MOIS_FR[date.getMonth()];
  return `${(j ?? '').charAt(0).toUpperCase() + (j ?? '').slice(1, 3)}. ${d} ${m}`;
}

export function dayBeforeLabel(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return `${d.getDate()} ${MOIS_SHORT[d.getMonth()]}`;
}

export function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getServiceDurationMinutes(dur: string): number {
  if (dur.includes('h')) {
    const [h, m] = dur.split('h');
    const hours = parseInt(h, 10) || 0;
    const mins  = parseInt(m, 10) || 0;
    return hours * 60 + mins;
  }
  return parseInt(dur, 10) || 30;
}

export function isSlotAvailable(slot: string, serviceDur: string): boolean {
  const [h, m]    = slot.split(':').map(Number);
  const slotMinutes = h * 60 + m;
  const endMinutes   = slotMinutes + getServiceDurationMinutes(serviceDur);
  return endMinutes <= CLOSING_MINUTES;
}

export function fmtPrice(n: number): string {
  return n % 1 === 0 ? `${n} €` : `${n.toFixed(2).replace('.', ',')} €`;
}
