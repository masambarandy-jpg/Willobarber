import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSegments } from 'expo-router';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { API_BASE_URL } from '@/constants';
import { useSSE } from '@/hooks/useSSE';
import type { CoiffeurSseEvent, ReservationNotificationData } from '@/types';

const SSE_EVENTS: readonly CoiffeurSseEvent[] = ['new_reservation', 'reservation_cancelled', 'reservation_updated'];
// Repli si le flux SSE ne passe pas (cf. useSSE) : rechargement périodique.
const FALLBACK_POLLING_MS = 5000;

export type NotifType = 'rdv' | 'avis' | 'paiement' | 'annulation' | 'rappel';
export type Section = "AUJOURD'HUI" | 'HIER';

export type Notif = {
  id: string;
  type: NotifType;
  title: string;
  desc: string;
  time: string;
  section: Section;
  unread: boolean;
  client?: string;
  avatarLetter?: string;
  service?: string;
  barber?: string;
  date?: string;
  // Heure du RDV — `time` est l'heure de création de la notification.
  rdvTime?: string;
  phone?: string;
  cancelledAt?: string;
  rating?: number;
  reviewText?: string;
  reviewId?: number;
  amount?: string;
  smsInfo?: string;
};

export const INITIAL_NOTIFICATIONS: Notif[] = [
  // AUJOURD'HUI
  {
    id: '1',
    type: 'rdv',
    title: 'Nouveau rendez-vous',
    desc: 'Antoine Rivière · Signature · 10:30',
    time: '09:12',
    section: "AUJOURD'HUI",
    unread: true,
    client: 'Antoine Rivière',
    service: 'Signature WilloBarber',
    barber: 'Willo',
    date: 'Mercredi 15 juillet 2026',
    rdvTime: '10:30',
    phone: '06 12 34 56 78',
  },
  {
    id: '2',
    type: 'avis',
    title: 'Nouvel avis 5★',
    desc: 'Thomas Leroy a laissé un avis',
    time: '08:40',
    section: "AUJOURD'HUI",
    unread: true,
    client: 'Thomas Leroy',
    avatarLetter: 'T',
    rating: 5,
    reviewText: 'Le meilleur barbier de Bruxelles. Willo prend le temps, écoute, et le résultat est toujours impeccable.',
    reviewId: 1,
  },
  {
    id: '3',
    type: 'paiement',
    title: 'Acompte reçu',
    desc: '10€ — Karim Benali',
    time: '08:05',
    section: "AUJOURD'HUI",
    unread: true,
    amount: '10€',
    client: 'Karim Benali',
  },
  // HIER
  {
    id: '4',
    type: 'annulation',
    title: 'Rendez-vous annulé',
    desc: 'Marc Dubois · Coupe express · 16:00',
    time: '18:22',
    section: 'HIER',
    unread: true,
    client: 'Marc Dubois',
    service: 'Coupe express',
    date: "Aujourd'hui 16:00",
    cancelledAt: '18:22',
  },
  {
    id: '5',
    type: 'rappel',
    title: 'Rappel envoyé',
    desc: 'SMS de rappel · 4 clients pour demain',
    time: '17:00',
    section: 'HIER',
    unread: true,
    smsInfo: '4 clients pour demain',
  },
  {
    id: '6',
    type: 'avis',
    title: 'Avis à traiter',
    desc: 'Karim Benali · sans réponse',
    time: '14:30',
    section: 'HIER',
    unread: false,
    client: 'Karim Benali',
    avatarLetter: 'K',
    rating: 5,
    reviewText: 'Un vrai moment de détente. La serviette chaude et le rasoir droit, c’est autre chose.',
    reviewId: 2,
  },
  {
    id: '7',
    type: 'paiement',
    title: 'Virement hebdomadaire',
    desc: '1 840€ versés sur votre compte',
    time: '09:00',
    section: 'HIER',
    unread: false,
    amount: '1 840€',
    client: 'Virement bancaire',
  },
];

// Forme brute renvoyée par GET/PATCH /api/notifications/ et par les
// événements SSE (NotificationSerializer côté backend). `data` porte les
// détails des RDV/annulations ; il vaut {} (ou manque) pour les notifications
// créées avant son ajout — chaque champ reste donc optionnel.
type ApiNotif = {
  id: number;
  type: NotifType;
  title: string;
  desc: string;
  data?: ReservationNotificationData | null;
  time: string;
  section: Section;
  unread: boolean;
};

type ReservationEvent = ReservationNotificationData & { notification?: ApiNotif };

function formatRdvDate(isoDate?: string): string | undefined {
  if (!isoDate) return undefined;
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const label = format(parsed, 'EEEE d MMMM yyyy', { locale: fr });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function mapApiNotif(n: ApiNotif): Notif {
  const d = n.data ?? {};
  return {
    id: String(n.id),
    type: n.type,
    title: n.title,
    desc: n.desc,
    time: n.time,
    section: n.section,
    unread: n.unread,
    client: d.client_name || undefined,
    service: d.service_name || undefined,
    barber: d.barber_name || undefined,
    date: formatRdvDate(d.date),
    rdvTime: d.time || undefined,
    phone: d.client_phone || undefined,
    cancelledAt: n.type === 'annulation' ? n.time : undefined,
  };
}

// Le coiffeur n'a pas de fiche Barber (Reservation n'a pas de barbier) : l'id
// de l'URL SSE est celui de l'utilisateur du JWT. Le backend diffuse de toute
// façon chaque événement à tous les coiffeurs connectés.
function userIdFromToken(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return String(payload.user_id ?? 0);
  } catch {
    return '0';
  }
}

type CoiffeurNotificationsContextType = {
  notifications: Notif[];
  unreadCount: number;
  loading: boolean;
  marquerLue: (id: string) => void;
  // Incrémenté à chaque RDV créé/annulé/modifié reçu en temps réel : les écrans
  // qui affichent des réservations (dashboard, planning) le mettent dans les
  // dépendances de leur fetch pour se recharger.
  reservationsVersion: number;
};

const CoiffeurNotificationsContext = createContext<CoiffeurNotificationsContextType>({
  notifications: INITIAL_NOTIFICATIONS,
  unreadCount: 0,
  loading: false,
  marquerLue: () => {},
  reservationsVersion: 0,
});

export function CoiffeurNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notif[]>(INITIAL_NOTIFICATIONS);
  const [loading, setLoading] = useState(true);
  // undefined = pas encore lu depuis AsyncStorage, null = coiffeur déconnecté.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [reservationsVersion, setReservationsVersion] = useState(0);
  const [polling, setPolling] = useState(false);
  const knownIds = useRef<Set<string> | null>(null);

  // Le provider englobe aussi l'écran de connexion (/coiffeur) : on relit le
  // token à chaque navigation pour ouvrir le flux après le login et le fermer
  // après le logout (parametres.tsx retire le token puis revient sur /coiffeur).
  const routeKey = useSegments().join('/');
  useEffect(() => {
    AsyncStorage.getItem('coiffeur_token').then(setToken);
  }, [routeKey]);

  // Nouvelle session : on retente le temps réel avant de retomber en polling.
  useEffect(() => {
    setPolling(false);
  }, [token]);

  const bumpReservations = useCallback(() => setReservationsVersion((v) => v + 1), []);

  const fetchNotifications = useCallback(async () => {
    if (token === undefined) return;
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: ApiNotif[] = await response.json();
      const mapped = data.map(mapApiNotif);

      // En polling, une notification inconnue signale un RDV créé/annulé.
      const previous = knownIds.current;
      knownIds.current = new Set(mapped.map((n) => n.id));
      if (previous && mapped.some((n) => !previous.has(n.id))) bumpReservations();

      setNotifications(mapped);
    } catch (error) {
      // Fallback sur les notifications hardcodées si l'API échoue.
      console.log('ERREUR NOTIFICATIONS — GET:', error);
    } finally {
      setLoading(false);
    }
  }, [token, bumpReservations]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const prependNotification = useCallback((raw?: ApiNotif) => {
    if (!raw) return;
    const notif = mapApiNotif(raw);
    knownIds.current?.add(notif.id);
    setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
  }, []);

  useSSE<CoiffeurSseEvent>({
    url: token && !polling
      ? `${API_BASE_URL}/sse/coiffeur/${userIdFromToken(token)}/?token=${encodeURIComponent(token)}`
      : null,
    events: SSE_EVENTS,
    onEvent: (event, data) => {
      const payload = (data ?? {}) as ReservationEvent;
      if (event === 'new_reservation' || event === 'reservation_cancelled') {
        prependNotification(payload.notification);
      }
      bumpReservations();
    },
    onOpen: (reconnect) => {
      // Des événements ont pu être perdus pendant la coupure : resynchronisation.
      if (reconnect) {
        fetchNotifications();
        bumpReservations();
      }
    },
    onFallback: () => setPolling(true),
  });

  useEffect(() => {
    if (!polling || !token) return;
    const id = setInterval(fetchNotifications, FALLBACK_POLLING_MS);
    return () => clearInterval(id);
  }, [polling, token, fetchNotifications]);

  const marquerLue = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));

    // Best-effort côté API : le compteur local (et donc le badge du menu latéral)
    // est déjà à jour ci-dessus, qu'importe le résultat de cet appel.
    (async () => {
      try {
        const token = await AsyncStorage.getItem('coiffeur_token');
        if (!token) return;
        await fetch(`${API_BASE_URL}/notifications/${id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ is_read: true }),
        });
      } catch (error) {
        console.log('ERREUR NOTIFICATIONS — PATCH is_read:', error);
      }
    })();
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <CoiffeurNotificationsContext.Provider value={{ notifications, unreadCount, loading, marquerLue, reservationsVersion }}>
      {children}
    </CoiffeurNotificationsContext.Provider>
  );
}

export function useCoiffeurNotifications(): CoiffeurNotificationsContextType {
  return useContext(CoiffeurNotificationsContext);
}
