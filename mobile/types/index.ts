// ─── Auth ───────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: 'client' | 'barber' | 'admin';
  language: 'fr' | 'nl' | 'en';
  dark_mode: boolean;
  ai_recommendations: boolean;
  loyalty_points: number;
  late_cancellations: number;
  created_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  password: string;
  password2: string;
}

// ─── Barber ──────────────────────────────────────────────────────────────────

export interface Barber {
  id: number;
  user: number;
  full_name: string;
  title: string;
  bio: string;
  specialties: string[];
  experience_years: number;
  color: string;
  is_active: boolean;
  avg_rating: number | null;
  review_count: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export type ServiceCategory = 'coupe_homme' | 'barbe' | 'package' | 'coloration' | 'soin' | 'enfant';

export interface Service {
  id: number;
  name: string;
  description: string;
  category: ServiceCategory;
  price: string;
  duration: number;
  is_popular: boolean;
  status: 'active' | 'draft' | 'inactive';
  image: string | null;
}

// ─── Availability ────────────────────────────────────────────────────────────

export interface TimeSlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export interface AvailableSlotsResponse {
  slots: TimeSlot[];
  date: string;
}

// ─── Reservation ─────────────────────────────────────────────────────────────

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled_client'
  | 'cancelled_barber'
  | 'no_show';

export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'fully_paid' | 'refunded';

export interface Reservation {
  id: number;
  reference: string;
  client: number;
  client_name: string;
  barber: number;
  barber_name: string;
  service: number;
  service_name: string;
  date: string;
  start_time: string;
  end_time: string;
  status: ReservationStatus;
  payment_status: PaymentStatus;
  deposit_amount: string;
  total_amount: string;
  notes: string;
  cancellation_reason: string;
  is_walk_in: boolean;
  person_count: number;
  created_at: string;
}

export interface CreateReservationPayload {
  service: number;
  date: string;
  time: string;
  notes?: string;
  payment_intent_id?: string;
  amount_paid?: number;
}

// ─── Review ──────────────────────────────────────────────────────────────────

export interface Review {
  id: number;
  reservation: number;
  client: number;
  client_name: string;
  barber: number;
  barber_name: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  reply: string;
  replied_at: string | null;
  status: 'pending' | 'published' | 'rejected';
  created_at: string;
}

// ─── Salon Settings ───────────────────────────────────────────────────────────

export interface SalonSettingsPublic {
  bookings_open: boolean;
  rush_mode_active: boolean;
  booking_cutoff_hour: number;
  min_booking_hours_ahead: number;
  same_day_surcharge: string;
}

// ─── Recommendations ─────────────────────────────────────────────────────────

export interface Recommendation {
  avg_interval_days: number;
  predicted_next_date: string;
  preferred_service_id: number | null;
  preferred_barber_id: number | null;
  suggested_slots: Array<{
    date: string;
    start_time: string;
    end_time: string;
    barber_id: number;
  }>;
}

// ─── Waiting List ─────────────────────────────────────────────────────────────

export interface WaitingListEntry {
  id: number;
  client: number;
  service: number;
  barber: number | null;
  preferred_date: string;
  preferred_time: string | null;
  status: 'waiting' | 'notified' | 'confirmed' | 'expired';
  position: number;
  created_at: string;
}

// ─── AI Recommendations ───────────────────────────────────────────────────────

export interface AiRecommendationResponse {
  recommendations: unknown[] | Record<string, unknown>;
  ai_text: string | null;
  message?: string;
}

// ─── API Generic ─────────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  field?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
