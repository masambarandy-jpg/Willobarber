import React, { createContext, useCallback, useContext, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://willobarber-production-6951.up.railway.app';

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
  phone?: string;
  cancelledAt?: string;
  rating?: number;
  reviewText?: string;
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

type CoiffeurNotificationsContextType = {
  notifications: Notif[];
  unreadCount: number;
  marquerLue: (id: string) => void;
};

const CoiffeurNotificationsContext = createContext<CoiffeurNotificationsContextType>({
  notifications: INITIAL_NOTIFICATIONS,
  unreadCount: 0,
  marquerLue: () => {},
});

export function CoiffeurNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notif[]>(INITIAL_NOTIFICATIONS);

  const marquerLue = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));

    // Best-effort côté API : le compteur local (et donc le badge du menu latéral)
    // est déjà à jour ci-dessus, qu'importe le résultat de cet appel — l'API
    // notifications n'existe pas encore forcément côté backend.
    (async () => {
      try {
        const token = await AsyncStorage.getItem('coiffeur_token');
        if (!token) return;
        await fetch(`${API_BASE_URL}/api/notifications/${id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ read: true }),
        });
      } catch (error) {
        console.log('ERREUR NOTIFICATIONS — PATCH read:', error);
      }
    })();
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <CoiffeurNotificationsContext.Provider value={{ notifications, unreadCount, marquerLue }}>
      {children}
    </CoiffeurNotificationsContext.Provider>
  );
}

export function useCoiffeurNotifications(): CoiffeurNotificationsContextType {
  return useContext(CoiffeurNotificationsContext);
}
