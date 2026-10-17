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
  /** Jour fermé (horaires hebdo ou fermeture exceptionnelle) : slots est vide. */
  is_closed?: boolean;
  open_time?: string | null;
  close_time?: string | null;
}

/** Horaires hebdomadaires du salon (weekday : lundi = 0, comme datetime.weekday()). */
export interface OpeningHoursDay {
  weekday: number;
  is_closed: boolean;
  open_time: string;
  close_time: string;
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
  // Agenda par barbier : prénom du barbier (Reservation.barber, cf. BARBER_CHOICES).
  barber: BarberName;
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
  qr_code?: string;
  checked_in?: boolean;
  checked_in_at?: string | null;
}

export type BarberName = 'Willo' | 'Malik' | 'Idris';

export interface CreateReservationPayload {
  service: number;
  barber?: BarberName;
  date: string;
  time: string;
  notes?: string;
  payment_intent_id?: string;
  amount_paid?: number;
  child_count?: number;
}

// ─── Review ──────────────────────────────────────────────────────────────────

export interface Review {
  id: number;
  user: number;
  client_name: string;
  reservation: number;
  service_name: string;
  reservation_date: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  created_at: string;
  reply?: string | null;
  replied_at?: string | null;
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

// ─── Closed periods (congés / fermetures) ────────────────────────────────────

export interface ClosedPeriod {
  id: number;
  start_date: string;
  end_date: string;
  reason: string;
  created_by: number | null;
  created_by_username: string | null;
  created_at: string;
}

// ─── Clients (espace coiffeur) ──────────────────────────────────────────────

// Statut CRM choisi manuellement par le coiffeur (aucun calcul automatique).
export type ClientStatus = 'nouveau' | 'vip' | 'fidele' | 'inactif' | 'a_risque';

export interface CoiffeurClient {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  total_reservations: number;
  last_visit: string | null;
  total_spent: number;
  date_joined: string;
  status: ClientStatus;
  is_archived: boolean;
  deleted_at: string | null;
  deletion_reason: string;
}

// ─── Notifications coiffeur & temps réel (SSE) ───────────────────────────────

// Notification.data côté backend (signals.reservation_payload). Tous les champs
// sont optionnels : les notifications antérieures à ce champ ont data = {}.
export interface ReservationNotificationData {
  reservation_id?: number;
  client_name?: string;
  client_phone?: string;
  service_name?: string;
  barber_name?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  price?: number;
  status?: string;
}

// Événements poussés par GET /api/sse/coiffeur/<id>/ (backend/core/sse.py).
export type CoiffeurSseEvent =
  | 'new_reservation'
  | 'reservation_cancelled'
  | 'reservation_updated'
  | 'new_boutique_order'
  | 'boutique_order_updated';

// ─── Commandes boutique côté coiffeur (backend/boutique) ─────────────────────

export type BoutiqueDeliveryType = 'domicile' | 'retrait_salon';

export type BoutiqueOrderStatus =
  | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'shipped' | 'delivered' | 'picked_up' | 'completed' | 'cancelled';

// Payload de l'événement SSE new_boutique_order et de Notification.data
// (boutique/invoices.py → order_payload).
export interface BoutiqueOrderNotificationData {
  order_id?: number;
  numero?: string;
  client_name?: string;
  client_phone?: string;
  items?: { name: string; qty: number; price: number }[];
  total?: number;
  delivery_type?: BoutiqueDeliveryType;
  delivery_address?: string;
  status?: BoutiqueOrderStatus;
  invoice_url?: string;
  created_at?: string;
}

// GET /api/boutique/gestion/commandes/ (StaffOrderSerializer).
export interface StaffBoutiqueOrder {
  id: number;
  numero: string;
  status: BoutiqueOrderStatus;
  status_label: string;
  total: string;
  delivery_type: BoutiqueDeliveryType;
  delivery_address: string;
  delivery_fee: string;
  paid_at: string | null;
  created_at: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  invoice_url: string;
  items: {
    id: number;
    quantite: number;
    prix_unitaire: string;
    product: { id: number; nom: string; contenance: string; photo_url: string };
  }[];
}

// ─── Recommandations (GET /recommendations/, backend/core/recommendations.py) ─

export interface SuggestedSlot {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  service_id: number;
  is_preferred: boolean;
  reason: string;
}

export interface ClientHabits {
  visits_count: number;
  last_visit_date: string | null;
  days_since_last_visit: number | null;
  avg_interval_days: number | null;
  favorite_service: { id: number; name: string; price: number; duration: number } | null;
  favorite_weekday: number | null; // 0 = lundi
  favorite_weekday_label: string | null;
  favorite_time: string | null;
  favorite_hour: number | null;
  next_expected_date: string | null;
  confidence: 'high' | 'medium' | null;
}

export interface RecommendationResponse {
  type: 'regular' | 'seasonal' | 'none';
  message: string | null;
  habits: ClientHabits;
  suggested_slots: SuggestedSlot[];
}

// ─── Cartes enregistrées (GET /auth/me/payment-methods/) ─────────────────────

export interface SavedPaymentMethod {
  id: string; // pm_…
  brand: string; // visa, mastercard, amex…
  last4: string;
  exp_month: number;
  exp_year: number;
}

// ─── Notifications client (GET /client-notifications/ + SSE /sse/client/) ────

// Événement SSE client order_status_changed (boutique/views.py).
export interface OrderStatusEvent {
  type: 'order_status_changed';
  order_id: number;
  order_number: string;
  status: BoutiqueOrderStatus;
  delivery_type: BoutiqueDeliveryType;
  message: string;
  notification_id: number;
}

export type ClientNotificationType = 'recommendation' | 'seasonal_reminder' | 'invoice' | 'boutique_invoice' | 'order_status';

export interface ClientNotification {
  id: number;
  type: ClientNotificationType;
  title: string;
  desc: string;
  data: {
    suggested_slots?: SuggestedSlot[];
    habits?: ClientHabits;
    days_since_last_visit?: number;
    reservation_id?: number;
    invoice_number?: string;
    invoice_url?: string;
    amount_paid?: number;
    order_id?: number;
    order_numero?: string;
    status?: BoutiqueOrderStatus;
  };
  unread: boolean;
  created_at: string;
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
