import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
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
    return SecureStore.getItemAsync(SECURE_KEY_ACCESS);
  },
  async getRefresh(): Promise<string | null> {
    return SecureStore.getItemAsync(SECURE_KEY_REFRESH);
  },
  async save(access: string, refresh: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(SECURE_KEY_ACCESS, access),
      SecureStore.setItemAsync(SECURE_KEY_REFRESH, refresh),
    ]);
  },
  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(SECURE_KEY_ACCESS),
      SecureStore.deleteItemAsync(SECURE_KEY_REFRESH),
    ]);
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
      isRefreshing = true;

      try {
        const refresh = await TokenStorage.getRefresh();
        if (!refresh) throw new Error('No refresh token');

        const { data } = await axios.post<{ access: string }>(
          `${API_BASE_URL}/auth/refresh/`,
          { refresh },
        );

        await SecureStore.setItemAsync(SECURE_KEY_ACCESS, data.access);
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
  login: (payload: LoginPayload) =>
    http.post<AuthResponse>('/auth/login/', payload).then((r) => r.data),

  register: (payload: RegisterPayload) =>
    http.post<AuthResponse>('/auth/register/', payload).then((r) => r.data),

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
};

// ─── Reviews API ─────────────────────────────────────────────────────────────

export const reviewsApi = {
  list: () => http.get<Review[]>('/reviews/').then((r) => r.data),

  create: (payload: { reservation: number; rating: number; comment?: string }) =>
    http.post<Review>('/reviews/', payload).then((r) => r.data),
};

// ─── Salon settings API ───────────────────────────────────────────────────────

export const settingsApi = {
  get: () => http.get<SalonSettingsPublic>('/settings/').then((r) => r.data),
};

// ─── Recommendations API ──────────────────────────────────────────────────────

export const recommendationsApi = {
  get: () => http.get('/recommendations/').then((r) => r.data),
};

// ─── Waiting list API ────────────────────────────────────────────────────────

export const waitingListApi = {
  list: () => http.get<WaitingListEntry[]>('/waiting-list/').then((r) => r.data),
  create: (payload: { service: number; preferred_date: string; barber?: number; preferred_time?: string }) =>
    http.post<WaitingListEntry>('/waiting-list/', payload).then((r) => r.data),
};

export default http;
