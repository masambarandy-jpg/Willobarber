import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
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
  AiRecommendationResponse,
  ClosedPeriod,
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
        // Pas de refresh token (jamais connecté, ou session déjà nettoyée) :
        // on ne tente rien, on nettoie et on rejette silencieusement — pas
        // d'Error levée, rien à afficher à l'utilisateur.
        await TokenStorage.clear();
        processQueue('no_refresh_token', null);
        return Promise.reject('no_refresh_token');
      }

      isRefreshing = true;

      try {
        const { data } = await axios.post<{ access: string }>(
          `${API_BASE_URL}/auth/token/refresh/`,
          { refresh },
        );

        await TokenStorage.setAccess(data.access);
        http.defaults.headers.common.Authorization = `Bearer ${data.access}`;
        processQueue(null, data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return http(original);
      } catch (err) {
        processQueue(err, null);
        await TokenStorage.clear();
        return Promise.reject(err);
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

  passwordlessLogin: (identifier: string) =>
    http.post<AuthResponse>('/auth/passwordless-login/', { email: identifier }).then((r) => r.data),

  logout: (refresh: string) =>
    http.post('/auth/logout/', { refresh }),

  me: () => http.get<User>('/auth/me/').then((r) => r.data),

  updateProfile: (data: Partial<User>) =>
    http.patch<User>('/auth/me/', data).then((r) => r.data),

  changePassword: (payload: { old_password: string; new_password: string; new_password2: string }) =>
    http.post('/auth/change-password/', payload).then((r) => r.data),
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
  available: (barberId: number, date: string) =>
    http
      .get<AvailableSlotsResponse>('/slots/available/', { params: { barber_id: barberId, date } })
      .then((r) => r.data),

  lock: (barberId: number, date: string, startTime: string) =>
    http.post('/slots/lock/', { barber_id: barberId, date, start_time: startTime }).then((r) => r.data),

  unlock: (barberId: number, date: string, startTime: string) =>
    http.delete('/slots/unlock/', { data: { barber_id: barberId, date, start_time: startTime } }),
};

// ─── Reservations API ────────────────────────────────────────────────────────

export const reservationsApi = {
  list: (status?: string) =>
    http.get<Reservation[]>('/reservations/', { params: status ? { status } : {} }).then((r) => r.data),

  create: (payload: CreateReservationPayload) =>
    http.post<Reservation>('/reservations/', payload).then((r) => r.data),

  cancel: (id: number, reason?: string) =>
    http.post(`/reservations/${id}/cancel/`, { reason: reason ?? '' }).then((r) => r.data),

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

export const paymentsApi = {
  createPaymentIntent: (amount: number, currency: string = 'eur') =>
    http
      .post<{ clientSecret: string }>('/payments/create-payment-intent/', { amount, currency })
      .then((r) => {
        console.log(
          'CLIENT SECRET:', r.data.clientSecret,
          '— format valide:', typeof r.data.clientSecret === 'string' && r.data.clientSecret.startsWith('pi_'),
        );
        return r.data;
      }),
};

// ─── Reviews API ─────────────────────────────────────────────────────────────

export const reviewsApi = {
  list: () => http.get<Review[]>('/reviews/').then((r) => r.data),

  mine: () => http.get<Review[]>('/reviews/client/').then((r) => r.data),

  create: (payload: { reservation: number; rating: number; comment?: string }) =>
    http.post<Review>('/reviews/', payload).then((r) => r.data),
};

// ─── Salon settings API ───────────────────────────────────────────────────────

export const settingsApi = {
  get: () => http.get<SalonSettingsPublic>('/settings/').then((r) => r.data),
};

// ─── Recommendations API ──────────────────────────────────────────────────────

export const recommendationsApi = {
  get: () => http.get<AiRecommendationResponse>('/recommendations/').then((r) => {
    console.log('[IA] fetch recommendations response status:', r.status);
    console.log('[IA] fetch recommendations data:', JSON.stringify(r.data));
    return r.data;
  }),
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

export default http;
