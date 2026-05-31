import { useCallback, useEffect, useState } from 'react';
import { barbersApi } from '@/services/api';
import type { Barber } from '@/types';

export function useBarbers() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await barbersApi.list();
      setBarbers(data);
    } catch {
      setError('Impossible de charger les barbiers.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { barbers, isLoading, error, refetch: fetch };
}
