import { useCallback, useEffect, useState } from 'react';
import { mediaApi, ClientMedia } from '@/services/api';

export function useClientMedia(clientId: number | null | undefined) {
  const [media, setMedia] = useState<ClientMedia[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const refetch = useCallback(async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      const data = await mediaApi.listForClient(clientId);
      setMedia(data);
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const upload = useCallback(
    async (file: File | { uri: string; name: string; type: string }, caption?: string) => {
      if (!clientId) return;
      setIsUploading(true);
      try {
        const created = await mediaApi.upload(clientId, file, caption);
        setMedia((prev) => [created, ...prev]);
      } finally {
        setIsUploading(false);
      }
    },
    [clientId]
  );

  return { media, isLoading, isUploading, refetch, upload };
}
