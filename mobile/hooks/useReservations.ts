import { useCallback, useEffect, useState } from 'react';
import { reservationsApi } from '@/services/api';
import type { Reservation } from '@/types';

export function useReservations(statusFilter?: string) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await reservationsApi.list(statusFilter);
      setReservations(data);
    } catch {
      setError('Impossible de charger les réservations.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const cancel = useCallback(async (id: number, reason?: string) => {
    await reservationsApi.cancel(id, reason);
    // Mise à jour optimiste : dès que le serveur a confirmé l'annulation, on
    // retire le RDV de `upcoming` immédiatement (recalculé depuis `reservations`)
    // sans attendre l'aller-retour du fetch() de réconciliation ci-dessous.
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'cancelled_client' } : r)),
    );
    await fetch();
  }, [fetch]);

  const upcoming = reservations.filter(
    (r) => r.status === 'pending' || r.status === 'confirmed',
  );
  const past = reservations.filter(
    (r) => r.status === 'completed' || r.status === 'cancelled_client' || r.status === 'cancelled_barber' || r.status === 'no_show',
  );

  return { reservations, upcoming, past, isLoading, error, refetch: fetch, cancel };
}
