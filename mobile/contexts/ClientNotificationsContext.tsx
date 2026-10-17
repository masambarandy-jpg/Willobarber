import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ORDER_STATUS_COLORS } from '@/components/BoutiqueOrderDetailModal';
import { NotificationToast, type ToastData } from '@/components/NotificationToast';
import { API_BASE_URL } from '@/constants';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useSSE } from '@/hooks/useSSE';
import { clientNotificationsApi, TokenStorage } from '@/services/api';
import type { ClientNotification, CommentReplyEvent, OrderStatusEvent, WaitlistAvailableEvent } from '@/types';

// notification : nouvelle entrée de la 🔔. Toasts (la notif cloche arrive à part) :
// order_status_changed quand le coiffeur fait avancer une commande boutique,
// new_comment_reply quand le barbier répond à un commentaire de RDV,
// waitlist_available quand un créneau suivi en liste d'attente se libère.
const SSE_EVENTS = ['notification', 'order_status_changed', 'new_comment_reply', 'waitlist_available'] as const;
const DATE_LOCALES = { fr: 'fr-BE', nl: 'nl-BE', en: 'en-GB' } as const;
// Repli si le flux SSE ne passe pas (cf. useSSE) : les notifications client ne
// sont pas critiques à la seconde près, un rechargement toutes les 30 s suffit.
const FALLBACK_POLLING_MS = 30000;

type ClientNotificationsContextType = {
  notifications: ClientNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: number) => void;
  // Incrémenté à chaque réponse du barbier reçue en temps réel : l'historique
  // des RDV recharge alors les commentaires du client.
  commentReplyVersion: number;
};

const ClientNotificationsContext = createContext<ClientNotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  refresh: async () => {},
  markRead: () => {},
  commentReplyVersion: 0,
});

export function ClientNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const hideToast = useCallback(() => setToast(null), []);
  const [commentReplyVersion, setCommentReplyVersion] = useState(0);

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
    onEvent: (event, data) => {
      if (event === 'order_status_changed') {
        const payload = data as OrderStatusEvent | null;
        if (!payload?.order_id) return;
        setToast({
          message: payload.message,
          subtitle: `Commande ${payload.order_number}`,
          // Pastille : or = en préparation, bleu = en route / prête, vert = terminée.
          color: ORDER_STATUS_COLORS[payload.status]?.text,
          href: '/(tabs)/notifications',
          testID: 'order-status-toast',
        });
        return;
      }
      if (event === 'new_comment_reply') {
        const payload = data as CommentReplyEvent | null;
        if (!payload?.reservation_id) return;
        setCommentReplyVersion((v) => v + 1);
        setToast({
          message: t('comment.replyToast'),
          subtitle: `${payload.barber_name} : « ${payload.reply} »`,
          href: reservationHref(payload.reservation_id),
          testID: 'comment-reply-toast',
        });
        return;
      }
      if (event === 'waitlist_available') {
        const payload = data as WaitlistAvailableEvent | null;
        if (!payload?.date) return;
        const [y, m, d] = payload.date.split('-').map(Number);
        const day = new Date(y, m - 1, d).toLocaleDateString(DATE_LOCALES[language], {
          weekday: 'short', day: 'numeric', month: 'short',
        });
        setToast({
          message: t('waitlist.slotAvailable')
            .replace('{barber}', payload.barber)
            .replace('{date}', day)
            .replace('{time}', payload.time),
          subtitle: t('waitlist.slotAvailableAction'),
          href: waitlistBookingHref(payload),
          testID: 'waitlist-available-toast',
        });
        return;
      }
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
    <ClientNotificationsContext.Provider value={{ notifications, unreadCount, loading, refresh, markRead, commentReplyVersion }}>
      {children}
      <NotificationToast
        toast={toast}
        onHide={hideToast}
        onPress={({ href }) => {
          setToast(null);
          router.push(href as never);
        }}
      />
    </ClientNotificationsContext.Provider>
  );
}

// Fiche du RDV dans l'historique (cf. reservations.tsx) ; `at` permet de
// rouvrir le même RDV depuis une notification suivante.
export function reservationHref(reservationId: number): string {
  return `/(tabs)/reservations?reservationId=${reservationId}&at=${Date.now()}`;
}

// Wizard de réservation sur le créneau libéré (cf. mode waitlist de book.tsx).
export function waitlistBookingHref(slot: { barber: string; date: string; time: string; service_name?: string }): string {
  const params = new URLSearchParams({
    waitlist: 'true',
    barbier: slot.barber,
    date: slot.date,
    heure: slot.time.slice(0, 5),
    at: String(Date.now()),
  });
  if (slot.service_name) params.set('prestation', slot.service_name);
  return `/(tabs)/book?${params.toString()}`;
}

export function useClientNotifications(): ClientNotificationsContextType {
  return useContext(ClientNotificationsContext);
}
