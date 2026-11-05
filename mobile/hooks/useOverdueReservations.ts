import { useEffect, useMemo, useState } from 'react';
import { NO_SHOW_GRACE_MS, isCancellableStatus, salonStartMs } from '@/utils/reservationTime';

const REFRESH_MS = 30 * 1000;

type OverdueCandidate = {
  date: string;
  time: string;
  status: string;
  checked_in_at?: string | null;
  parent_reservation?: number | null;
};

// RDV du jour non honorés : délai de grâce de 15 min dépassé, sans check-in.
// Les RDV enfants suivent leur parent : seul celui-ci se marque no-show.
export function useOverdueReservations<T extends OverdueCandidate>(reservations: T[]): T[] {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  return useMemo(
    () => reservations.filter((r) => (
      isCancellableStatus(r.status)
      && !r.checked_in_at
      && !r.parent_reservation
      && now > salonStartMs(r.date, r.time) + NO_SHOW_GRACE_MS
    )),
    [reservations, now],
  );
}
