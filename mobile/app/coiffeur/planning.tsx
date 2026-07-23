import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  PersonIcon,
  CalendarIcon,
  ClockIcon,
  ScissorsIcon,
  UsersIcon,
} from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';
import { useIsTablet } from '@/components/coiffeur/useIsTablet';

const HOUR_HEIGHT = 66;
const START_HOUR = 11;
const END_HOUR = 19;
const API_BASE_URL = 'https://willobarber-production-6951.up.railway.app';

type Barber = 'Willo' | 'Malik' | 'Idris';

const BARBER_CHIPS: { key: Barber; color: string }[] = [
  { key: 'Willo', color: '#C9A84C' },
  { key: 'Malik', color: '#8a5a35' },
  { key: 'Idris', color: '#2D6A4F' },
];

const BARBER_STYLE: Record<Barber, { bg: string; border: string }> = {
  Willo: { bg: '#3a2f12', border: '#C9A84C' },
  Malik: { bg: '#33241a', border: '#8a5a35' },
  Idris: { bg: '#1d3328', border: '#2D6A4F' },
};

type PaymentStatus = 'unpaid' | 'paid_onsite' | 'paid_online';
type PaymentMethodType = 'cash' | 'card' | '';

type Event = {
  id: number;
  time: string;
  date: string; // dateKey() format, matches Date-derived keys used throughout this screen
  service: string;
  client: string;
  barber: Barber;
  amount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethodType;
};

// Réel : /api/reservations/ → id, user, user_username, service, service_name,
// service_price, date, time, status, payment_intent_id, payment_status,
// payment_method, amount_paid (pas de champ barbier côté API)
type ApiReservation = {
  id: number;
  user: number;
  user_username: string;
  service: number;
  service_name: string;
  service_price: string;
  date: string;
  time: string;
  status: string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethodType;
  amount_paid: string | null;
};

function dateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function isSameDay(a: Date, b: Date) {
  return dateKey(a) === dateKey(b);
}

function parseApiDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function fmtEuro(n: number): string {
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function timeOffset(time: string) {
  const [h, m] = time.split(':').map(Number);
  return (((h - START_HOUR) * 60 + m) / 60) * HOUR_HEIGHT;
}

function capitalize(s: string) {
  return (s ?? '').charAt(0).toUpperCase() + (s ?? '').slice(1);
}

function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateLabel(date: Date, view: (typeof VIEW_MODES)[number]) {
  if (view === 'Jour') {
    return capitalize(date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' }));
  }
  if (view === 'Semaine') {
    const start = getWeekStart(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const endMonth = capitalize(end.toLocaleDateString('fr-FR', { month: 'long' }));
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
    }
    const startMonth = capitalize(start.toLocaleDateString('fr-FR', { month: 'long' }));
    return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
  }
  return capitalize(date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
}

function getMonthGrid(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(1 - startOffset);

  const lastOfMonth = new Date(year, month + 1, 0);
  const endOffset = (7 - (((lastOfMonth.getDay() + 6) % 7) + 1)) % 7;
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(lastOfMonth.getDate() + endOffset);

  const days: Date[] = [];
  const cur = new Date(gridStart);
  while (cur <= gridEnd) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function getNowPosition() {
  const now = new Date();
  const totalMinutes = (now.getHours() - START_HOUR) * 60 + now.getMinutes();
  return (totalMinutes / 60) * HOUR_HEIGHT;
}

// ─── Fallback démo ──────────────────────────────────────────────────────────
// Utilisé uniquement quand l'API est injoignable/vide (ex. pendant la défense),
// pour que le planning ne soit jamais vide. Les RDV mock ont un id négatif afin
// de pouvoir être reconnus et traités "hors-ligne" par confirmPayment().

const MOCK_SERVICE_PRICES: Record<string, number> = {
  'Signature WilloBarber': 45,
  'Taille & rasage': 28,
  'Camouflage gris': 35,
  'Le Rituel': 75,
  'Coupe express': 28,
  'Soin du visage': 32,
};
const MOCK_SERVICES = Object.keys(MOCK_SERVICE_PRICES);
const MOCK_CLIENTS = ['Antoine R.', 'Karim B.', 'Noé V.', 'Léo M.', 'Thomas L.', 'Marc D.', 'Hugo P.'];
const MOCK_BARBERS: Barber[] = ['Willo', 'Malik', 'Idris'];

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return () => {
    h = Math.imul(h ^ (h >>> 15), 1 | h);
    h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h;
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMockEventsByDate(): Record<string, Event[]> {
  const today = new Date();
  const map: Record<string, Event[]> = {};
  let mockId = -1;

  // Le jour courant est toujours peuplé, pour que Jour/Semaine/Mois montrent
  // tous quelque chose sans dépendre de la date à laquelle on regarde la démo.
  const todaySlots = ['11:00', '12:00', '13:30', '15:00', '16:00', '17:30', '18:00'];
  const todayKey = dateKey(today);
  map[todayKey] = todaySlots.map((time, i) => {
    const service = MOCK_SERVICES[i % MOCK_SERVICES.length];
    const paid = i % 3 === 0;
    return {
      id: mockId--,
      time,
      date: todayKey,
      service,
      client: MOCK_CLIENTS[i % MOCK_CLIENTS.length],
      barber: MOCK_BARBERS[i % MOCK_BARBERS.length],
      amount: MOCK_SERVICE_PRICES[service],
      paymentStatus: paid ? 'paid_onsite' : 'unpaid',
      paymentMethod: paid ? (i % 2 === 0 ? 'cash' : 'card') : '',
    } as Event;
  });

  // Quelques RDV sur le reste du mois pour que les vues Semaine/Mois ne soient
  // pas vides non plus (grille déterministe via seededRandom, pas de flicker).
  for (let offset = -14; offset <= 14; offset++) {
    if (offset === 0) continue;
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const rand = seededRandom(dateKey(d));
    if (rand() > 0.55) continue;

    const key = dateKey(d);
    const count = 1 + Math.floor(rand() * 2);
    map[key] = Array.from({ length: count }, () => {
      const service = MOCK_SERVICES[Math.floor(rand() * MOCK_SERVICES.length)];
      const hour = START_HOUR + Math.floor(rand() * (END_HOUR - START_HOUR));
      const paid = rand() > 0.5;
      return {
        id: mockId--,
        time: `${hour.toString().padStart(2, '0')}:${rand() > 0.5 ? '30' : '00'}`,
        date: key,
        service,
        client: MOCK_CLIENTS[Math.floor(rand() * MOCK_CLIENTS.length)],
        barber: MOCK_BARBERS[Math.floor(rand() * MOCK_BARBERS.length)],
        amount: MOCK_SERVICE_PRICES[service],
        paymentStatus: paid ? 'paid_onsite' : 'unpaid',
        paymentMethod: paid ? (rand() > 0.5 ? 'cash' : 'card') : '',
      } as Event;
    }).sort((a, b) => a.time.localeCompare(b.time));
  }

  return map;
}

const VIEW_MODES = ['Jour', 'Semaine', 'Mois'] as const;
const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function CoiffeurPlanningScreen() {
  const isTablet = useIsTablet();
  const [viewMode, setViewMode] = useState<(typeof VIEW_MODES)[number]>(() => (isTablet ? 'Semaine' : 'Jour'));
  const [selectedBarbers, setSelectedBarbers] = useState<Barber[]>(['Willo', 'Malik', 'Idris']);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [nowPosition, setNowPosition] = useState(getNowPosition());
  const [selectedRdv, setSelectedRdv] = useState<Event | null>(null);
  const [rdvDetailVisible, setRdvDetailVisible] = useState(false);

  // undefined = pas encore lu dans AsyncStorage, null = lu mais absent, string = token trouvé
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [eventsByDate, setEventsByDate] = useState<Record<string, Event[]>>({});
  const [usingMockData, setUsingMockData] = useState(false);

  const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | null>(null);
  const [cashAmountInput, setCashAmountInput] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ouvrirDetailRdv = (event: Event) => {
    setSelectedRdv(event);
    setRdvDetailVisible(true);
    setPaymentMode(null);
    setCashAmountInput(event.amount.toFixed(2));
  };

  const fermerDetailRdv = () => {
    setRdvDetailVisible(false);
    setPaymentMode(null);
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 2500);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Le token du gérant est stocké sous 'coiffeur_token' (cf. app/coiffeur/index.tsx)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await AsyncStorage.getItem('coiffeur_token');
      console.log('TOKEN PLANNING:', t);
      if (!cancelled) setToken(t);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (token === undefined) return;
    let cancelled = false;

    // 'ok' = données réelles chargées, 'empty' = API répond mais 0 réservation,
    // 'error' = échec réseau/HTTP (401 compris). 'empty' et 'error' déclenchent
    // le fallback mock plus bas pour que le planning ne soit jamais vide.
    const attemptFetch = async (): Promise<'ok' | 'empty' | 'error'> => {
      try {
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        console.log('TOKEN PLANNING:', token);

        const res = await fetch(`${API_BASE_URL}/api/reservations/`, { headers });
        console.log('RESERVATIONS STATUS:', res.status);

        const raw = await res.json().catch(() => null);
        console.log('RESERVATIONS DATA:', JSON.stringify(raw));

        if (!res.ok) return 'error';

        const reservations: ApiReservation[] = Array.isArray(raw) ? raw : (raw?.results ?? []);
        if (reservations.length === 0) return 'empty';

        const map: Record<string, Event[]> = {};
        reservations
          .filter((r) => r.status !== 'cancelled')
          .forEach((r) => {
            const key = dateKey(parseApiDate(r.date));
            const event: Event = {
              id: r.id,
              time: r.time.slice(0, 5),
              date: key,
              service: r.service_name,
              client: r.user_username,
              barber: 'Willo', // pas d'endpoint équipe/affectation barbier : fallback
              amount: parseFloat(r.service_price) || 0,
              paymentStatus: r.payment_status,
              paymentMethod: r.payment_method,
            };
            if (!map[key]) map[key] = [];
            map[key].push(event);
          });
        Object.values(map).forEach((list) => list.sort((a, b) => a.time.localeCompare(b.time)));

        if (cancelled) return 'ok';
        setEventsByDate(map);
        setUsingMockData(false);
        return 'ok';
      } catch (error) {
        console.log('ERREUR PLANNING:', error);
        return 'error';
      }
    };

    (async () => {
      let result = await attemptFetch();
      if (result === 'error' && !cancelled) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!cancelled) result = await attemptFetch();
      }
      if (!cancelled && result !== 'ok') {
        console.log('PLANNING: fallback données mock —', result);
        setEventsByDate(buildMockEventsByDate());
        setUsingMockData(true);
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  const confirmPayment = async (method: 'cash' | 'card', amount: number) => {
    if (!selectedRdv) return;
    setSubmittingPayment(true);
    try {
      if (selectedRdv.id < 0) {
        // RDV de démonstration (fallback hors-ligne, id négatif) : on simule
        // l'encaissement localement plutôt que d'appeler un backend qui ne
        // connaît pas cet id, pour que la démo reste utilisable sans API.
        await new Promise((resolve) => setTimeout(resolve, 400));
        const updated: Event = { ...selectedRdv, paymentStatus: 'paid_onsite', paymentMethod: method };
        setSelectedRdv(updated);
        setEventsByDate((prev) => {
          const list = prev[updated.date] ?? [];
          return { ...prev, [updated.date]: list.map((e) => (e.id === updated.id ? updated : e)) };
        });
        setPaymentMode(null);
        showToast(`Paiement ${method === 'cash' ? 'espèces' : 'carte'} enregistré ✅ (démo)`);
        return;
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/reservations/${selectedRdv.id}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          payment_status: 'paid_onsite',
          payment_method: method,
          amount_paid: amount,
        }),
      });

      if (!res.ok) throw new Error(`payment-update-failed-${res.status}`);

      const updated: Event = { ...selectedRdv, paymentStatus: 'paid_onsite', paymentMethod: method };
      setSelectedRdv(updated);
      setEventsByDate((prev) => {
        const list = prev[updated.date] ?? [];
        return { ...prev, [updated.date]: list.map((e) => (e.id === updated.id ? updated : e)) };
      });
      setPaymentMode(null);

      // Encaissement enregistré : on génère et envoie la facture finale par email
      // (endpoint SendGrid côté backend — voir send_final_invoice).
      let invoiceSent = false;
      try {
        const invoiceRes = await fetch(`${API_BASE_URL}/api/reservations/${selectedRdv.id}/send-final-invoice/`, {
          method: 'POST',
          headers,
        });
        invoiceSent = invoiceRes.ok;
        if (!invoiceRes.ok) console.log('ERREUR ENVOI FACTURE:', invoiceRes.status);
      } catch (invoiceError) {
        console.log('ERREUR ENVOI FACTURE:', invoiceError);
      }

      const methodLabel = method === 'cash' ? 'espèces' : 'carte';
      showToast(
        invoiceSent
          ? `Paiement ${methodLabel} enregistré ✅ · Facture envoyée`
          : `Paiement ${methodLabel} enregistré ✅ (facture non envoyée)`
      );
    } catch (error) {
      console.log('ERREUR ENCAISSEMENT:', error);
      showToast("Erreur lors de l'encaissement");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const telechargerFacture = async () => {
    if (!selectedRdv) return;

    if (selectedRdv.id < 0) {
      showToast('Facture indisponible en mode démonstration.');
      return;
    }
    if (Platform.OS !== 'web') {
      showToast('Le téléchargement de la facture est disponible sur la version web.');
      return;
    }

    setDownloadingInvoice(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/reservations/${selectedRdv.id}/invoice/`, { headers });
      if (!res.ok) throw new Error(`invoice-download-failed-${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `facture-WB-${selectedRdv.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.log('ERREUR TELECHARGEMENT FACTURE:', error);
      showToast('Erreur lors du téléchargement de la facture');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => setNowPosition(getNowPosition()), 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleBarber = (b: Barber) => {
    setSelectedBarbers((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
  };

  const goBack = () => {
    const d = new Date(currentDate);
    if (viewMode === 'Jour') d.setDate(d.getDate() - 1);
    if (viewMode === 'Semaine') d.setDate(d.getDate() - 7);
    if (viewMode === 'Mois') d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const goNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'Jour') d.setDate(d.getDate() + 1);
    if (viewMode === 'Semaine') d.setDate(d.getDate() + 7);
    if (viewMode === 'Mois') d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const goToDay = (d: Date) => {
    setCurrentDate(d);
    setViewMode('Jour');
  };

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const isToday = isSameDay(currentDate, new Date());
  const showNowLine = isToday && new Date().getHours() >= START_HOUR && new Date().getHours() < END_HOUR;

  const dayEvents = useMemo(
    () => (eventsByDate[dateKey(currentDate)] ?? []).filter((e) => selectedBarbers.includes(e.barber)),
    [eventsByDate, currentDate, selectedBarbers]
  );

  const weekDays = useMemo(() => {
    const start = getWeekStart(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const monthDays = useMemo(() => getMonthGrid(currentDate), [currentDate]);
  const monthWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let i = 0; i < monthDays.length; i += 7) weeks.push(monthDays.slice(i, i + 7));
    return weeks;
  }, [monthDays]);

  return (
    <>
    <CoiffeurScreen active="planning">
      <Text style={styles.title}>Planning</Text>

      {usingMockData && (
        <View style={styles.mockBanner}>
          <Text style={styles.mockBannerText}>
            ⚠️ Aperçu de démonstration — API indisponible ou sans réservation, données fictives affichées.
          </Text>
        </View>
      )}

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>RDV SEMAINE</Text>
          <Text style={styles.statValue}>42</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TEMPS RÉSERVÉ</Text>
          <Text style={styles.statValue}>31h</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>CA PRÉVISIONNEL</Text>
          <Text style={styles.statValue}>1 840€</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TAUX REMPLISSAGE</Text>
          <Text style={styles.statValue}>78%</Text>
        </View>
      </View>

      {isTablet ? (
        <View style={styles.tabletToolbar}>
          <View style={styles.tabletToolbarRow}>
            <View style={styles.dateNavCompact}>
              <TouchableOpacity style={styles.navBtn} onPress={goBack}>
                <ChevronLeftIcon size={14} />
              </TouchableOpacity>
              <Text style={styles.dateTextCompact}>{formatDateLabel(currentDate, viewMode)}</Text>
              <TouchableOpacity style={styles.navBtn} onPress={goNext}>
                <ChevronRightIcon size={14} />
              </TouchableOpacity>
            </View>

            <View style={styles.viewToggleCompact}>
              {VIEW_MODES.map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.viewToggleItemCompact, viewMode === mode && styles.viewToggleItemActive]}
                  onPress={() => setViewMode(mode)}
                >
                  <Text
                    style={[styles.viewToggleText, viewMode === mode && styles.viewToggleTextActive]}
                    numberOfLines={1}
                  >
                    {mode}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterRow}>
            {BARBER_CHIPS.map((chip) => {
              const active = selectedBarbers.includes(chip.key);
              return (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.chip, !active && styles.chipInactive]}
                  onPress={() => toggleBarber(chip.key)}
                >
                  <View style={[styles.chipDot, { backgroundColor: chip.color }]} />
                  <Text style={styles.chipText}>{chip.key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : (
        <>
          <View style={styles.dateNav}>
            <TouchableOpacity style={styles.navBtn} onPress={goBack}>
              <ChevronLeftIcon size={14} />
            </TouchableOpacity>
            <Text style={styles.dateText}>{formatDateLabel(currentDate, viewMode)}</Text>
            <TouchableOpacity style={styles.navBtn} onPress={goNext}>
              <ChevronRightIcon size={14} />
            </TouchableOpacity>
          </View>

          <View style={styles.viewToggle}>
            {VIEW_MODES.map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.viewToggleItem, viewMode === mode && styles.viewToggleItemActive]}
                onPress={() => setViewMode(mode)}
              >
                <Text style={[styles.viewToggleText, viewMode === mode && styles.viewToggleTextActive]}>{mode}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.filterRow}>
            {BARBER_CHIPS.map((chip) => {
              const active = selectedBarbers.includes(chip.key);
              return (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.chip, !active && styles.chipInactive]}
                  onPress={() => toggleBarber(chip.key)}
                >
                  <View style={[styles.chipDot, { backgroundColor: chip.color }]} />
                  <Text style={styles.chipText}>{chip.key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {viewMode === 'Jour' && (
        <View style={styles.calendar}>
          {hours.map((h) => (
            <View key={h} style={styles.hourRow}>
              <Text style={styles.hourLabel}>{h}h</Text>
            </View>
          ))}
          <View style={styles.hourRowFinal}>
            <Text style={styles.hourLabel}>{END_HOUR}h</Text>
          </View>

          {showNowLine && (
            <View style={[styles.currentTimeLine, { top: nowPosition }]}>
              <View style={styles.currentTimeDot} />
              <View style={styles.currentTimeBar} />
            </View>
          )}

          {dayEvents.map((e) => {
            const style = BARBER_STYLE[e.barber];
            return (
              <TouchableOpacity
                key={e.id}
                activeOpacity={0.8}
                onPress={() => ouvrirDetailRdv(e)}
                style={[
                  styles.event,
                  {
                    top: timeOffset(e.time) + 2,
                    backgroundColor: style.bg,
                    borderLeftColor: style.border,
                  },
                ]}
              >
                <Text style={[styles.eventText, { color: style.border }]}>
                  {e.time} · {e.service}{e.paymentStatus !== 'unpaid' ? ' ✅' : ''}
                </Text>
                <Text style={styles.eventClient}>{e.client}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {viewMode === 'Semaine' && (
        <View style={styles.weekGrid}>
          {weekDays.map((d) => {
            const today = isSameDay(d, new Date());
            const events = (eventsByDate[dateKey(d)] ?? []).filter((e) => selectedBarbers.includes(e.barber));
            return (
              <TouchableOpacity
                key={dateKey(d)}
                style={[styles.weekColumn, today && styles.weekColumnToday]}
                onPress={() => goToDay(d)}
              >
                <Text style={styles.weekDayHeader}>
                  {capitalize(d.toLocaleDateString('fr-FR', { weekday: 'short' })).replace('.', '')} {d.getDate()}
                </Text>
                {events.map((e) => {
                  const style = BARBER_STYLE[e.barber];
                  return (
                    <TouchableOpacity
                      key={e.id}
                      activeOpacity={0.8}
                      onPress={() => ouvrirDetailRdv(e)}
                      style={[styles.weekEventCard, { backgroundColor: style.bg, borderLeftColor: style.border }]}
                    >
                      <Text style={[styles.weekEventText, { color: style.border }]} numberOfLines={1}>
                        {e.time}{e.paymentStatus !== 'unpaid' ? ' ✅' : ''}
                      </Text>
                      <Text style={styles.weekEventClient} numberOfLines={1}>
                        {e.client}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {viewMode === 'Mois' && (
        <View style={styles.monthGrid}>
          <View style={styles.monthWeekRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <View key={`${label}-${i}`} style={styles.monthDayCell}>
                <Text style={styles.monthHeaderLabel}>{label}</Text>
              </View>
            ))}
          </View>
          {monthWeeks.map((week, wi) => (
            <View key={wi} style={styles.monthWeekRow}>
              {week.map((d) => {
                const inMonth = d.getMonth() === currentDate.getMonth();
                const today = isSameDay(d, new Date());
                const hasEvents = (eventsByDate[dateKey(d)] ?? []).length > 0;
                return (
                  <TouchableOpacity
                    key={dateKey(d)}
                    style={styles.monthDayCell}
                    onPress={() => goToDay(d)}
                  >
                    <View style={[styles.monthDayNumberWrap, today && styles.monthDayToday]}>
                      <Text style={[styles.monthDayNumber, !inMonth && styles.monthDayOutside]}>{d.getDate()}</Text>
                    </View>
                    {hasEvents && <View style={styles.monthDayDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </CoiffeurScreen>

    <Modal
      visible={rdvDetailVisible}
      transparent
      animationType="fade"
      onRequestClose={fermerDetailRdv}
    >
      <Pressable style={styles.rdvOverlay} onPress={fermerDetailRdv}>
        <Pressable style={styles.rdvCard} onPress={(e) => e.stopPropagation()}>
          <TouchableOpacity style={styles.rdvCloseBtn} onPress={fermerDetailRdv}>
            <CloseIcon size={13} />
          </TouchableOpacity>

          {selectedRdv && (
            <>
              <View style={[styles.rdvBarberCircle, { backgroundColor: BARBER_STYLE[selectedRdv.barber].border }]}>
                <Text style={styles.rdvBarberInitial}>{(selectedRdv.barber ?? '').charAt(0).toUpperCase()}</Text>
              </View>

              <Text style={styles.rdvTitle}>{selectedRdv.service}</Text>
              <Text style={styles.rdvSubtitle}>avec {selectedRdv.barber}</Text>

              <View style={styles.rdvDetailsBlock}>
                <View style={styles.rdvDetailRow}>
                  <PersonIcon size={16} color={CC.textSecondary} />
                  <View>
                    <Text style={styles.rdvDetailLabel}>CLIENT</Text>
                    <Text style={styles.rdvDetailValue}>{selectedRdv.client}</Text>
                  </View>
                </View>
                <View style={styles.rdvDetailRow}>
                  <CalendarIcon size={16} color={CC.textSecondary} />
                  <View>
                    <Text style={styles.rdvDetailLabel}>HEURE</Text>
                    <Text style={styles.rdvDetailValue}>{selectedRdv.time}</Text>
                  </View>
                </View>
                <View style={styles.rdvDetailRow}>
                  <ScissorsIcon size={16} color={CC.textSecondary} />
                  <View>
                    <Text style={styles.rdvDetailLabel}>PRESTATION</Text>
                    <Text style={styles.rdvDetailValue}>{selectedRdv.service}</Text>
                  </View>
                </View>
                <View style={styles.rdvDetailRow}>
                  <UsersIcon size={16} color={CC.textSecondary} />
                  <View>
                    <Text style={styles.rdvDetailLabel}>BARBIER</Text>
                    <Text style={styles.rdvDetailValue}>{selectedRdv.barber}</Text>
                  </View>
                </View>
                <View style={styles.rdvDetailRow}>
                  <Text style={styles.rdvAmountIcon}>€</Text>
                  <View>
                    <Text style={styles.rdvDetailLabel}>MONTANT</Text>
                    <Text style={styles.rdvDetailValue}>{fmtEuro(selectedRdv.amount)}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.paymentStatusRow}>
                <Text style={styles.rdvDetailLabel}>STATUT PAIEMENT</Text>
                {selectedRdv.paymentStatus !== 'unpaid' ? (
                  <View style={styles.paidBadge}>
                    <Text style={styles.paidBadgeText}>Payé ✅</Text>
                  </View>
                ) : (
                  <View style={styles.unpaidBadge}>
                    <Text style={styles.unpaidBadgeText}>Non payé</Text>
                  </View>
                )}
              </View>

              {selectedRdv.paymentStatus !== 'unpaid' && (
                <TouchableOpacity
                  style={[styles.downloadInvoiceBtn, downloadingInvoice && styles.btnDisabled]}
                  onPress={telechargerFacture}
                  disabled={downloadingInvoice}
                >
                  <Text style={styles.downloadInvoiceBtnText}>
                    {downloadingInvoice ? 'Téléchargement…' : '📄 Télécharger la facture'}
                  </Text>
                </TouchableOpacity>
              )}

              {selectedRdv.paymentStatus === 'unpaid' && (
                <View style={styles.paymentActionsBlock}>
                  {paymentMode === null && (
                    <View style={styles.paymentMethodRow}>
                      <TouchableOpacity
                        style={styles.paymentMethodBtn}
                        onPress={() => setPaymentMode('cash')}
                        disabled={submittingPayment}
                      >
                        <Text style={styles.paymentMethodBtnText}>💵 Cash</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.paymentMethodBtn}
                        onPress={() => confirmPayment('card', selectedRdv.amount)}
                        disabled={submittingPayment}
                      >
                        <Text style={styles.paymentMethodBtnText}>💳 Carte</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {paymentMode === 'cash' && (
                    <View style={styles.cashBlock}>
                      <Text style={styles.rdvDetailLabel}>MONTANT REÇU</Text>
                      <TextInput
                        style={styles.cashInput}
                        value={cashAmountInput}
                        onChangeText={setCashAmountInput}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={CC.textSecondary}
                        editable={!submittingPayment}
                      />
                      <TouchableOpacity
                        style={[styles.validateBtn, submittingPayment && styles.btnDisabled]}
                        disabled={submittingPayment}
                        onPress={() => confirmPayment('cash', parseFloat(cashAmountInput.replace(',', '.')) || 0)}
                      >
                        <Text style={styles.validateBtnText}>
                          {submittingPayment ? 'Validation…' : "Valider l'encaissement"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.rdvDivider} />

              <View style={styles.rdvActionsRow}>
                <TouchableOpacity style={styles.rdvCancelBtn} onPress={fermerDetailRdv}>
                  <Text style={styles.rdvCancelBtnText}>Fermer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rdvCallBtn}>
                  <Text style={styles.rdvCallBtnText}>Appeler</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>

    {toastMessage && (
      <View style={styles.toastContainer} pointerEvents="none">
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      </View>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 30,
    color: CC.black,
    marginBottom: 18,
  },
  mockBanner: {
    backgroundColor: CC.errorBg,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  mockBannerText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: CC.errorText,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  statCard: {
    width: '47%',
    backgroundColor: CC.white,
    borderRadius: 14,
    padding: 14,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: CC.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  statValue: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 22,
    color: CC.black,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 14,
  },
  tabletToolbar: {
    marginBottom: 4,
  },
  tabletToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dateNavCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateTextCompact: {
    fontSize: 15,
    fontWeight: '700',
    color: CC.black,
    minWidth: 170,
    textAlign: 'center',
  },
  viewToggleCompact: {
    flexDirection: 'row',
    backgroundColor: CC.barTrackBg,
    borderRadius: 9,
    padding: 3,
    width: 240,
  },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CC.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CC.white,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: CC.black,
    minWidth: 100,
    textAlign: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: CC.barTrackBg,
    borderRadius: 9,
    padding: 3,
    marginBottom: 14,
  },
  viewToggleItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
  },
  viewToggleItemCompact: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 7,
    alignItems: 'center',
  },
  viewToggleItemActive: {
    backgroundColor: CC.white,
  },
  viewToggleText: {
    fontSize: 12.5,
    color: CC.textSecondary,
    fontWeight: '600',
  },
  viewToggleTextActive: {
    color: CC.black,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: CC.white,
  },
  chipInactive: {
    opacity: 0.4,
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: CC.black,
  },
  calendar: {
    position: 'relative',
    marginLeft: 0,
  },
  hourRow: {
    height: HOUR_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: CC.barTrackBg,
    paddingLeft: 2,
  },
  hourRowFinal: {
    height: 1,
    borderTopWidth: 1,
    borderTopColor: CC.barTrackBg,
  },
  hourLabel: {
    width: 36,
    fontSize: 11,
    color: CC.textSecondary,
    marginTop: -6,
  },
  currentTimeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C0392B',
    marginRight: -4,
    marginLeft: 32,
    zIndex: 2,
  },
  currentTimeBar: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#C0392B',
  },
  event: {
    position: 'absolute',
    left: 44,
    right: 0,
    minHeight: 56,
    borderRadius: 8,
    borderLeftWidth: 3,
    padding: 8,
    justifyContent: 'center',
  },
  eventText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  eventClient: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  weekGrid: {
    flexDirection: 'row',
  },
  weekColumn: {
    flex: 1,
    minHeight: 260,
    paddingHorizontal: 3,
    paddingTop: 4,
    borderRightWidth: 1,
    borderRightColor: CC.barTrackBg,
    borderRadius: 6,
  },
  weekColumnToday: {
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  weekDayHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: CC.textSecondary,
    textAlign: 'center',
    marginBottom: 6,
  },
  weekEventCard: {
    borderRadius: 6,
    borderLeftWidth: 2,
    padding: 4,
    marginBottom: 4,
  },
  weekEventText: {
    fontSize: 9,
    fontWeight: '700',
  },
  weekEventClient: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  monthGrid: {
    gap: 2,
  },
  monthWeekRow: {
    flexDirection: 'row',
  },
  monthDayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: CC.textSecondary,
  },
  monthDayNumberWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDayToday: {
    borderWidth: 1.5,
    borderColor: CC.gold,
  },
  monthDayNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: CC.black,
  },
  monthDayOutside: {
    color: CC.textSecondary,
    opacity: 0.35,
  },
  monthDayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: CC.gold,
    marginTop: 2,
  },
  rdvOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  rdvCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: CC.white,
    borderRadius: 20,
    padding: 24,
  },
  rdvCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: CC.trackBg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  rdvBarberCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  rdvBarberInitial: {
    color: CC.white,
    fontWeight: '700',
    fontSize: 18,
  },
  rdvTitle: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 22,
    color: CC.black,
    textAlign: 'center',
    marginBottom: 4,
  },
  rdvSubtitle: {
    fontSize: 13,
    color: CC.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  rdvDetailsBlock: {
    gap: 12,
    marginBottom: 20,
  },
  rdvDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rdvDetailLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: CC.textSecondary,
    letterSpacing: 0.5,
  },
  rdvDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: CC.black,
    marginTop: 1,
  },
  rdvAmountIcon: {
    width: 16,
    fontSize: 15,
    fontWeight: '700',
    color: CC.textSecondary,
    textAlign: 'center',
  },
  rdvDivider: {
    height: 1,
    backgroundColor: CC.trackBg,
    marginBottom: 16,
  },
  rdvActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rdvCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: CC.border,
    alignItems: 'center',
  },
  rdvCancelBtnText: {
    fontWeight: '600',
    color: CC.black,
  },
  rdvCallBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 100,
    backgroundColor: CC.gold,
    alignItems: 'center',
  },
  rdvCallBtnText: {
    fontWeight: '700',
    color: CC.black,
  },

  paymentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CC.trackBg,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  paidBadge: {
    backgroundColor: CC.successBg,
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  paidBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: CC.successText,
  },
  unpaidBadge: {
    backgroundColor: CC.errorBg,
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  unpaidBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: CC.errorText,
  },

  downloadInvoiceBtn: {
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: CC.inputBorder,
    backgroundColor: CC.cream,
    alignItems: 'center',
    marginBottom: 16,
  },
  downloadInvoiceBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: CC.black,
  },

  paymentActionsBlock: {
    marginBottom: 16,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentMethodBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: CC.inputBorder,
    backgroundColor: CC.cream,
    alignItems: 'center',
  },
  paymentMethodBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: CC.black,
  },
  cashBlock: {
    gap: 8,
  },
  cashInput: {
    borderWidth: 1,
    borderColor: CC.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: CC.black,
    backgroundColor: CC.cream,
  },
  validateBtn: {
    paddingVertical: 13,
    borderRadius: 100,
    backgroundColor: CC.gold,
    alignItems: 'center',
  },
  validateBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: CC.black,
  },
  btnDisabled: {
    opacity: 0.5,
  },

  toastContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: CC.black,
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 20,
    maxWidth: '90%',
  },
  toastText: {
    color: CC.white,
    fontSize: 13,
    fontWeight: '600',
  },
});
