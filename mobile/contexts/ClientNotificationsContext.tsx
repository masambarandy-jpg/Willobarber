import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_BASE_URL } from '@/constants';
import { useAuth } from '@/hooks/useAuth';
import { useSSE } from '@/hooks/useSSE';
import { clientNotificationsApi, TokenStorage } from '@/services/api';
import type { ClientNotification } from '@/types';

const SSE_EVENTS = ['notification'] as const;
// Repli si le flux SSE ne passe pas (cf. useSSE) : les notifications client ne
// sont pas critiques à la seconde près, un rechargement toutes les 30 s suffit.
const FALLBACK_POLLING_MS = 30000;

type ClientNotificationsContextType = {
  notifications: ClientNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: number) => void;
};

const ClientNotificationsContext = createContext<ClientNotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  refresh: async () => {},
  markRead: () => {},
});

export function ClientNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setToken(null);
      setNotifications([]);
      return;
    }
    TokenStorage.getAccess().then(setToken);
    setPolling(false);
  }, [isAuthenticated]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      setNotifications(await clientNotificationsApi.list());
    } catch {
      // Liste conservée telle quelle : nouvel essai au prochain refresh / polling.
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useSSE<(typeof SSE_EVENTS)[number]>({
    url: token && !polling ? `${API_BASE_URL}/sse/client/?token=${encodeURIComponent(token)}` : null,
    events: SSE_EVENTS,
    onEvent: (_event, data) => {
      const notif = data as ClientNotification | null;
      if (!notif?.id) return;
      setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
    },
    onOpen: (reconnect) => {
      // Des notifications ont pu être publiées pendant la coupure.
      if (reconnect) refresh();
    },
    onFallback: () => setPolling(true),
  });

  useEffect(() => {
    if (!polling || !isAuthenticated) return;
    const id = setInterval(refresh, FALLBACK_POLLING_MS);
    return () => clearInterval(id);
  }, [polling, isAuthenticated, refresh]);

  const markRead = useCallback((id: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    clientNotificationsApi.markRead(id).catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <ClientNotificationsContext.Provider value={{ notifications, unreadCount, loading, refresh, markRead }}>
      {children}
    </ClientNotificationsContext.Provider>
  );
}

export function useClientNotifications(): ClientNotificationsContextType {
  return useContext(ClientNotificationsContext);
}
