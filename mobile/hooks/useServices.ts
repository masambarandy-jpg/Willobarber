import { useCallback, useEffect, useState } from 'react';
import { servicesApi } from '@/services/api';
import type { Service, ServiceCategory } from '@/types';

export function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await servicesApi.list();
      setServices(data);
    } catch {
      setError('Impossible de charger les services.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const byCategory = (category: ServiceCategory) =>
    services.filter((s) => s.category === category);

  const popular = services.filter((s) => s.is_popular);

  const categories = [...new Set(services.map((s) => s.category))] as ServiceCategory[];

  return { services, popular, categories, byCategory, isLoading, error, refetch: fetch };
}
