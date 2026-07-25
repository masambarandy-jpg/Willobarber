import { useCallback, useEffect, useState } from 'react';
import { mediaApi, ClientMedia } from '@/services/api';

export function useClientMedia(clientId: number | null | undefined) {
  const [media, setMedia] = useState<ClientMedia[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sharingId, setSharingId] = useState<number | null>(null);

  const refetch = useCallback(async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      const data = await mediaApi.listForClient(clientId);
      setMedia(data);
    } catch {
      // Jamais d'erreur (401, refresh manquant, réseau...) ne doit remonter
      // jusqu'à l'UI de "Mes coupes" — galerie vide plutôt qu'un toast.
      setMedia([]);
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
        if (created) setMedia((prev) => [created, ...prev]);
      } catch {
        // Échec silencieux : pas de toast, l'appelant peut se fier à isUploading
        // qui retombe à false pour savoir que l'upload n'a pas abouti.
      } finally {
        setIsUploading(false);
      }
    },
    [clientId]
  );

  const share = useCallback(async (id: number) => {
    setSharingId(id);
    try {
      const updated = await mediaApi.share(id);
      if (updated) setMedia((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } catch {
      // Échec silencieux, cohérent avec upload : le bouton reste sur
      // "Envoyer au client" si le partage n'a pas abouti.
    } finally {
      setSharingId(null);
    }
  }, []);

  return { media, isLoading, isUploading, sharingId, refetch, upload, share };
}
