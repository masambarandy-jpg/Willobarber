import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { API_BASE_URL } from '@/constants';
import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  User,
  Barber,
  Service,
  Reservation,
  CreateReservationPayload,
  Review,
  AvailableSlotsResponse,
  SalonSettingsPublic,
  WaitingListEntry,
  RecommendationResponse,
  ClientNotification,
  SavedPaymentMethod,
  ClosedPeriod,
  OpeningHoursDay,
  ClientStatus,
  CoiffeurClient,
  StaffBoutiqueOrder,
  BoutiqueOrderStatus,
  BarberName,
} from '@/types';

const SECURE_KEY_ACCESS = 'wb_access_token';
const SECURE_KEY_REFRESH = 'wb_refresh_token';

const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Token helpers ───────────────────────────────────────────────────────────

export const TokenStorage = {
  async getAccess(): Promise<string | null> {
    if (Platform.OS === 'web') return localStorage.getItem(SECURE_KEY_ACCESS);
    return SecureStore.getItemAsync(SECURE_KEY_ACCESS);
  },
  async getRefresh(): Promise<string | null> {
    if (Platform.OS === 'web') return localStorage.getItem(SECURE_KEY_REFRESH);
    return SecureStore.getItemAsync(SECURE_KEY_REFRESH);
  },
  async setAccess(token: string): Promise<void> {
    if (Platform.OS === 'web') { localStorage.setItem(SECURE_KEY_ACCESS, token); return; }
    return SecureStore.setItemAsync(SECURE_KEY_ACCESS, token);
  },
  async setRefresh(token: string): Promise<void> {
    if (Platform.OS === 'web') { localStorage.setItem(SECURE_KEY_REFRESH, token); return; }
    return SecureStore.setItemAsync(SECURE_KEY_REFRESH, token);
  },
  async save(access: string, refresh: string): Promise<void> {
    await Promise.all([
      TokenStorage.setAccess(access),
      TokenStorage.setRefresh(refresh),
    ]);
  },
  async clear(): Promise<void> {
    if (Platform.OS === 'web') { localStorage.removeItem(SECURE_KEY_ACCESS); localStorage.removeItem(SECURE_KEY_REFRESH); return; }
    await SecureStore.deleteItemAsync(SECURE_KEY_ACCESS);
    await SecureStore.deleteItemAsync(SECURE_KEY_REFRESH);
  },
};

// ─── Request interceptor — attach Bearer token ───────────────────────────────

http.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await TokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Session expirée ─────────────────────────────────────────────────────────
// Refresh impossible (absent, expiré ou blacklisté) : les tokens sont effacés
// et AuthProvider est prévenu pour repasser l'app en « déconnecté » — sinon
// l'UI se croit connectée et les appels suivants partent sans Authorization.

export class SessionExpiredError extends Error {
  constructor() {
    super('session_expired');
    this.name = 'SessionExpiredError';
  }
}

const sessionExpiredListeners = new Set<() => void>();

export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

async function expireSession(): Promise<SessionExpiredError> {
  await TokenStorage.clear();
  sessionExpiredListeners.forEach((listener) => listener());
  return new SessionExpiredError();
}

// ─── Response interceptor — refresh on 401 ───────────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => (token ? p.resolve(token) : p.reject(error)));
  failedQueue = [];
};

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return http(original);
        });
      }

      original._retry = true;

      const refresh = await TokenStorage.getRefresh();
      if (!refresh) {
        // Pas de refresh token (jamais connecté, ou session déjà nettoyée).
        const expired = await expireSession();
        processQueue(expired, null);
        return Promise.reject(expired);
      }

      isRefreshing = true;

      try {
        // ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION côté backend : la
        // réponse contient un NOUVEAU refresh et l'ancien est blacklisté. Il
        // faut donc le garder, sinon le refresh suivant échoue (« Token is
        // blacklisted ») et la session saute sans prévenir.
        const { data } = await axios.post<{ access: string; refresh?: string }>(
          `${API_BASE_URL}/auth/token/refresh/`,
          { refresh },
        );

        if (data.refresh) await TokenStorage.save(data.access, data.refresh);
        else await TokenStorage.setAccess(data.access);
        processQueue(null, data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return http(original);
      } catch {
        const expired = await expireSession();
        processQueue(expired, null);
        return Promise.reject(expired);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─── Auth API ────────────────────────────────────────────────────────────────

export const authApi = {
  login: (payload: LoginPayload) => {
    console.log('LOGIN PAYLOAD:', JSON.stringify({ username: payload.username, password: payload.password }));
    console.log('LOGIN URL:', http.defaults.baseURL + '/auth/login/');
    return http.post<AuthResponse>('/auth/login/', payload).then((r) => r.data);
  },

  register: (payload: RegisterPayload) =>
    http.post<AuthResponse>('/auth/register/', payload).then((r) => r.data),


  // Connexion Google : on transmet l'id_token signé par Google, que le backend
  // vérifie et dont il lit l'email — crée le compte s'il n'existe pas encore
  // (cf. OAuthLoginView).
  oauthLogin: (idToken: string) =>
    http
      .post<AuthResponse>('/auth/oauth-login/', { provider: 'google', id_token: idToken })
      .then((r) => r.data),

  logout: (refresh: string) =>
    http.post('/auth/logout/', { refresh }),

  deleteAccount: (refresh?: string) =>
    http.delete('/auth/delete-account/', { data: refresh ? { refresh } : undefined }),

  me: () => http.get<User>('/auth/me/').then((r) => r.data),

  updateProfile: (data: Partial<User>) =>
    http.patch<User>('/auth/me/', data).then((r) => r.data),

  changePassword: (payload: { old_password: string; new_password: string; new_password2: string }) =>
    http.post('/auth/change-password/', payload).then((r) => r.data),

  requestPasswordReset: (email: string) =>
    http.post<{ detail: string }>('/auth/password-reset/', { email }).then((r) => r.data),
};

// ─── Barbers API ─────────────────────────────────────────────────────────────

export const barbersApi = {
  list: () => http.get<Barber[]>('/barbers/').then((r) => r.data),
  get: (id: number) => http.get<Barber>(`/barbers/${id}/`).then((r) => r.data),
};

// ─── Services API ─────────────────────────────────────────────────────────────

export const servicesApi = {
  list: () => http.get<Service[]>('/services/').then((r) => r.data),
  get: (id: number) => http.get<Service>(`/services/${id}/`).then((r) => r.data),
};

// ─── Slots API ───────────────────────────────────────────────────────────────

export const slotsApi = {
  // Agenda du barbier (prénom, ex. 'Malik') : un créneau pris chez Willo reste libre chez Malik.
  available: (barber: BarberName, date: string) =>
    http
      .get<AvailableSlotsResponse>('/slots/available/', { params: { barber, date } })
      .then((r) => r.data),

  lock: (barber: BarberName, date: string, startTime: string) =>
    http.post('/slots/lock/', { barber, date, start_time: startTime }).then((r) => r.data),

  unlock: (barber: BarberName, date: string, startTime: string) =>
    http.delete('/slots/unlock/', { data: { barber, date, start_time: startTime } }),
};

// ─── Reservations API ────────────────────────────────────────────────────────

export const reservationsApi = {
  list: (status?: string) =>
    http.get<Reservation[]>('/reservations/', { params: status ? { status } : {} }).then((r) => r.data),

  create: (payload: CreateReservationPayload) =>
    http.post<Reservation>('/reservations/', payload).then((r) => r.data),

  // Le endpoint POST /reservations/{id}/cancel/ n'existe pas sur le backend
  // déployé (confirmé en prod : 404 — seules les routes CRUD standard du
  // ReservationViewSet sont enregistrées). L'annulation client passe donc par
  // un PATCH classique sur la ressource, comme le reste du CRUD.
  cancel: (id: number, reason?: string) =>
    http
      .patch<Reservation>(`/reservations/${id}/`, {
        status: 'cancelled_client',
        cancellation_reason: reason ?? '',
      })
      .then((r) => r.data),

  // Reprogrammer un RDV existant — même endpoint CRUD que cancel(), avec
  // 'date'/'time' (les noms de champs réels du serializer, pas 'start_time').
  reschedule: (id: number, payload: { date: string; time: string }) =>
    http.patch<Reservation>(`/reservations/${id}/`, payload).then((r) => r.data),

  qr: (id: number) =>
    http.get<{ reservation_id: number; qr_code: string; checked_in: boolean }>(`/reservations/${id}/qr/`).then((r) => r.data),
};

// ─── Check-in API (scan QR côté Willo) ────────────────────────────────────────

export interface CheckinResponse {
  success: boolean;
  already_checked_in: boolean;
  reservation_id: number;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  service_name: string;
  date: string;
  time: string;
  checked_in_at: string;
}

export const checkinApi = {
  scan: (qrCode: string) =>
    http.post<CheckinResponse>(`/checkin/${qrCode}/`).then((r) => r.data),
};

// ─── Payments API ────────────────────────────────────────────────────────────

export interface PaymentIntentResponse {
  clientSecret: string;
  // 'succeeded' : carte enregistrée débitée côté serveur, rien à confirmer.
  // 'requires_action' : la banque exige une authentification 3DS.
  status?: string;
  paymentIntentId?: string;
}

// Commande boutique à payer : le backend en recalcule le montant depuis les
// prix en base (amount n'est alors plus qu'indicatif).
export interface BoutiqueOrderPayload {
  items: { product_id: number; quantite: number }[];
  delivery_type: 'retrait_salon' | 'domicile';
  delivery_address: string;
}

export const paymentsApi = {
  createPaymentIntent: (amount: number, currency: string = 'eur', paymentMethodId?: string, order?: BoutiqueOrderPayload) =>
    http
      .post<PaymentIntentResponse>('/payments/create-payment-intent/', {
        amount,
        currency,
        ...(paymentMethodId ? { payment_method: paymentMethodId } : {}),
        ...(order ? { order } : {}),
      })
      .then((r) => {
        console.log(
          'CLIENT SECRET:', r.data.clientSecret,
          '— format valide:', typeof r.data.clientSecret === 'string' && r.data.clientSecret.startsWith('pi_'),
        );
        return r.data;
      }),
};

// ─── Cartes enregistrées (Stripe Customer) ───────────────────────────────────

export const paymentMethodsApi = {
  list: () => http.get<SavedPaymentMethod[]>('/auth/me/payment-methods/').then((r) => r.data),

  remove: (id: string) => http.delete(`/auth/me/payment-methods/${id}/`),
};

// ─── Reviews API ─────────────────────────────────────────────────────────────

export const reviewsApi = {
  list: () => http.get<Review[]>('/reviews/').then((r) => r.data),

  mine: () => http.get<Review[]>('/reviews/client/').then((r) => r.data),

  create: (payload: { reservation: number; rating: number; comment?: string }) =>
    http.post<Review>('/reviews/', payload).then((r) => r.data),
};

// ─── Loyalty API ───────────────────────────────────────────────────────────────

export const loyaltyApi = {
  redeem: () => http.post<{ loyalty_points: number; redeemed: number }>('/loyalty/redeem/').then((r) => r.data),
};

// ─── Salon settings API ───────────────────────────────────────────────────────

export const settingsApi = {
  get: () => http.get<SalonSettingsPublic>('/settings/').then((r) => r.data),
};

// ─── Recommendations API ──────────────────────────────────────────────────────

export const recommendationsApi = {
  // excludeSlots : clés « YYYY-MM-DDTHH:MM » déjà proposées — le backend
  // renvoie alors 3 nouvelles alternatives (bouton « Voir d'autres créneaux »).
  get: (excludeSlots: string[] = []) =>
    http
      .get<RecommendationResponse>('/recommendations/', {
        params: excludeSlots.length ? { exclude: excludeSlots.join(',') } : {},
      })
      .then((r) => r.data),
};

// ─── Client notifications API ────────────────────────────────────────────────

export const clientNotificationsApi = {
  list: () => http.get<ClientNotification[]>('/client-notifications/').then((r) => r.data),

  markRead: (id: number) =>
    http.patch<ClientNotification>(`/client-notifications/${id}/`, { is_read: true }).then((r) => r.data),
};

// ─── Appointments API ────────────────────────────────────────────────────────

export const appointmentsApi = {
  checkClient: (identifier: string) =>
    http
      .post<{ status: 'exists' | 'new'; first_name?: string }>('/appointments/check-client/', { identifier })
      .then((r) => r.data),
};

// ─── Closed periods API (congés / fermetures) ────────────────────────────────

export const closedPeriodsApi = {
  list: () => http.get<ClosedPeriod[]>('/closed-periods/').then((r) => r.data),
};

// ─── Opening hours API (horaires hebdo du salon) ─────────────────────────────

export const openingHoursApi = {
  list: () => http.get<OpeningHoursDay[]>('/opening-hours/').then((r) => r.data),
};

// ─── Boutique API (produits — stock) ─────────────────────────────────────────

export type BoutiqueProduct = {
  id: number;
  nom: string;
  categorie: string;
  description: string;
  prix: string;
  contenance: string;
  photo_url: string;
  stock: number;
  stock_alert: number;
  actif: boolean;
  created_at: string;
};

export const boutiqueApi = {
  products: () => http.get<BoutiqueProduct[]>('/boutique/produits/').then((r) => r.data),

  createOrder: <T,>(payload: {
    items: { product_id: number; quantite: number }[];
    payment_intent_id: string;
    delivery_type: string;
    delivery_address: string;
  }) => http.post<T>('/boutique/commandes/', payload).then((r) => r.data),
};

// ─── Session coiffeur (token dédié 'coiffeur_token') ─────────────────────────
// L'access token expire (7 j) et devient invalide si SECRET_KEY change : sans
// refresh, tous les appels coiffeur renvoyaient 401 en silence (notifications
// factices, onglet Commandes en erreur, SSE refusé).

export class CoiffeurApiError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

// Une seule requête de refresh à la fois : avec ROTATE_REFRESH_TOKENS +
// BLACKLIST_AFTER_ROTATION, un 2e refresh parallèle utiliserait un refresh
// token déjà blacklisté et déconnecterait le coiffeur.
let coiffeurRefreshInFlight: Promise<string | null> | null = null;

function refreshCoiffeurToken(): Promise<string | null> {
  coiffeurRefreshInFlight ??= (async () => {
    try {
      const refresh = await AsyncStorage.getItem('coiffeur_refresh');
      if (!refresh) return null;
      const res = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) return null;
      const data: { access: string; refresh?: string } = await res.json();
      await AsyncStorage.setItem('coiffeur_token', data.access);
      if (data.refresh) await AsyncStorage.setItem('coiffeur_refresh', data.refresh);
      return data.access;
    } catch {
      return null;
    } finally {
      coiffeurRefreshInFlight = null;
    }
  })();
  return coiffeurRefreshInFlight;
}

// fetch authentifié coiffeur : sur 401, refresh puis un seul nouvel essai. Si
// la session est irrécupérable, retour à l'écran de connexion gérant.
export async function coiffeurAuthFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string | null) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
    });

  const token = await AsyncStorage.getItem('coiffeur_token');
  if (!token) throw new CoiffeurApiError(401);
  let res = await send(token);
  if (res.status === 401) {
    const fresh = await refreshCoiffeurToken();
    if (fresh) res = await send(fresh);
    if (!fresh || res.status === 401) {
      await AsyncStorage.multiRemove(['coiffeur_token', 'coiffeur_refresh']);
      router.replace('/coiffeur');
    }
  }
  return res;
}

async function coiffeurFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await coiffeurAuthFetch(path, init);
  if (!res.ok) throw new CoiffeurApiError(res.status);
  return res.json() as Promise<T>;
}

// GET /api/barbers/availability/ (barbers_week_availability côté backend).
export type BarberDayAvailability = {
  date: string; // YYYY-MM-DD
  state: 'open' | 'closed' | 'leave' | 'past';
  free: number;
  booked: number;
  total: number;
  reason?: string;
};

export type WeekAvailability = {
  week_start: string;
  barbers: Record<BarberName, { total_rdv: number; week_rdv: number; days: BarberDayAvailability[] }>;
};

export const coiffeurTeamApi = {
  weekAvailability: () => coiffeurFetch<WeekAvailability>('/barbers/availability/'),
};

export const coiffeurBoutiqueApi = {
  orders: (period: 'today' | 'week' | 'all' = 'week') =>
    coiffeurFetch<StaffBoutiqueOrder[]>(`/boutique/gestion/commandes/?period=${period}`),

  order: (id: number) => coiffeurFetch<StaffBoutiqueOrder>(`/boutique/gestion/commandes/${id}/`),

  setStatus: (id: number, status: BoutiqueOrderStatus) =>
    coiffeurFetch<StaffBoutiqueOrder>(`/boutique/gestion/commandes/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

// ─── Waiting list API ────────────────────────────────────────────────────────

export const waitingListApi = {
  list: () => http.get<WaitingListEntry[]>('/waiting-list/').then((r) => r.data),
  create: (payload: { service: number; preferred_date: string; barber?: number; preferred_time?: string }) =>
    http.post<WaitingListEntry>('/waiting-list/', payload).then((r) => r.data),
};

// ─── Client media API (photos/vidéos avant/après) ────────────────────────────

export type ClientMedia = {
  id: number;
  client: number;
  reservation: number | null;
  media_type: 'photo' | 'video';
  cloudinary_url: string;
  cloudinary_public_id: string;
  caption: string;
  shared_with_client: boolean;
  created_at: string;
};

export const mediaApi = {
  // L'upload se fait depuis l'espace coiffeur : le token client géré par
  // l'instance axios `http` n'est pas le bon JWT (rôle admin/staff requis par
  // le backend), d'où le fetch direct avec le token coiffeur dédié.
  //
  // La lecture (listForClient), elle, est appelée à la fois côté coiffeur
  // (galerie d'un client depuis /coiffeur/clients) et côté client (onglet
  // "Mes coupes") — le backend autorise le staff/admin OU le client lui-même
  // (voir client_media_list). On tente donc le token coiffeur en priorité,
  // et on retombe sur le JWT du client connecté (TokenStorage) sinon.
  listForClient: async (clientId: number): Promise<ClientMedia[]> => {
    const token = (await AsyncStorage.getItem('coiffeur_token')) || (await TokenStorage.getAccess());
    if (!token) {
      console.log('[MEDIA] listForClient: aucun token disponible pour client', clientId);
      return [];
    }

    const url = `${API_BASE_URL}/clients/${clientId}/media/`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('[MEDIA] GET', url, '→', res.status);
    if (!res.ok) return [];
    return res.json() as Promise<ClientMedia[]>;
  },

  upload: async (
    clientId: number,
    file: File | { uri: string; name: string; type: string },
    caption?: string
  ): Promise<ClientMedia | null> => {
    const token = await AsyncStorage.getItem('coiffeur_token');
    console.log('MEDIA UPLOAD TOKEN:', token ? token.substring(0, 20) + '...' : 'NULL');
    if (!token) return null;

    const form = new FormData();
    form.append('client', String(clientId));
    if (caption) form.append('caption', caption);
    form.append('file', file as unknown as Blob);

    const res = await fetch(`${API_BASE_URL}/media/upload/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) return null;
    return res.json() as Promise<ClientMedia>;
  },

  // Partage d'une photo/vidéo avec le client (staff only) — le token coiffeur
  // est requis, comme pour l'upload.
  share: async (id: number): Promise<ClientMedia | null> => {
    const token = await AsyncStorage.getItem('coiffeur_token');
    if (!token) return null;

    const url = `${API_BASE_URL}/media/${id}/share/`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('[MEDIA] PATCH', url, '→', res.status);
    if (!res.ok) return null;
    return res.json() as Promise<ClientMedia>;
  },
};

// Actions CRM de l'espace coiffeur : token coiffeur dédié (rôle staff requis),
// même raison que mediaApi.upload ci-dessus.
async function patchClient(path: string, body?: object): Promise<CoiffeurClient | null> {
  const token = await AsyncStorage.getItem('coiffeur_token');
  if (!token) return null;

  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  console.log('[CLIENTS] PATCH', url, '→', res.status);
  if (!res.ok) return null;
  return res.json() as Promise<CoiffeurClient>;
}

export const clientsApi = {
  archive: (id: number) => patchClient(`/clients/${id}/archive/`),
  unarchive: (id: number) => patchClient(`/clients/${id}/unarchive/`),
  setStatus: (id: number, status: ClientStatus) => patchClient(`/clients/${id}/status/`, { status }),
};

export default http;
