import { useCallback, useEffect, useState } from 'react';
import { slotsApi } from '@/services/api';
import type { TimeSlot } from '@/types';

export function useSlots(barberId: number | null, date: string | null) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!barberId || !date) {
      setSlots([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await slotsApi.available(barberId, date);
      setSlots(data.slots);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Impossible de charger les créneaux.';
      setError(msg);
      setSlots([]);
    } finally {
      setIsLoading(false);
    }
  }, [barberId, date]);

  useEffect(() => { fetch(); }, [fetch]);

  const available = slots.filter((s) => s.is_available);

  const lock = useCallback(
    async (startTime: string) => {
      if (!barberId || !date) return;
      await slotsApi.lock(barberId, date, startTime);
    },
    [barberId, date],
  );

  const unlock = useCallback(
    async (startTime: string) => {
      if (!barberId || !date) return;
      await slotsApi.unlock(barberId, date, startTime);
    },
    [barberId, date],
  );

  return { slots, available, isLoading, error, refetch: fetch, lock, unlock };
}
