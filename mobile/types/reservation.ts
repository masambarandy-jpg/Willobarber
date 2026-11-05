export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'cancelled_client'
  | 'cancelled_barber'
  | 'cancelled_and_refunded'
  | 'cancelled_late_no_refund'
  | 'cancelled_no_show'
  | 'cancelled_by_salon_refunded'
  | 'no_show';

export type CancelByBarberReason = 'client_no_show' | 'client_requested' | 'salon_unavailable';

export type CancelByBarberRequest = {
  reason: CancelByBarberReason;
  notes?: string;
};

// Réponse commune de /reservations/<id>/cancel/ et /cancel-by-barber/.
export type CancelResponse = {
  status: ReservationStatus;
  reason?: CancelByBarberReason;
  refund_amount: number;
  loyalty_points_removed: number;
  message: string;
};
