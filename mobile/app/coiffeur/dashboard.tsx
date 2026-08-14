import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import * as XLSX from 'xlsx';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import Avatar from '@/components/coiffeur/Avatar';
import { DownloadIcon, UsersIcon, ListIcon, PersonIcon, CalendarIcon, ChevronDownIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';
import { useIsTablet } from '@/components/coiffeur/useIsTablet';

// jsPDF s'appuie sur des API navigateur indisponibles sur iOS/Android natif
// (Expo Go) — un import statique fait planter l'app au chargement du module,
// avant même l'appel de genererRapport(). On ne le require() que sur web.
const jsPDF: typeof import('jspdf').jsPDF | null =
  Platform.OS === 'web' ? require('jspdf').jsPDF : null;

type Period = 'jour' | 'semaine' | 'mois';

const PERIODS: Period[] = ['jour', 'semaine', 'mois'];
const PERIOD_LABELS: Record<Period, string> = { jour: 'Jour', semaine: 'Semaine', mois: 'Mois' };

const API_BASE_URL = 'https://willobarber-production-6951.up.railway.app';
const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const JOURS_SEMAINE_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

type CaPeriodData = { total: string; bars: { label: string; v: number }[]; active: string };
type UpcomingClient = { id: number; letter: string; name: string; service: string; barber: string; time: string };
type TopService = { name: string; pct: number };
type TopServiceWithCount = TopService & { count: number };

type AnalyticsData = {
  peakHour: { label: string; count: number; pct: number };
  bestDay: { label: string; total: number };
  topBarber: { name: string; count: number; revenue: number };
  topClient: { name: string; count: number };
};

type ExportReservation = ApiReservation & { price: number };

type ApiProduct = {
  id: number;
  nom: string;
  stock: number;
  stock_alert: number;
};

// Réel : /api/reservations/ → {id, user, user_username, client_display_name, service, service_name, date, time,
// status, payment_status} (pas de champ barber_name côté API)
type ApiReservation = {
  id: number;
  user: number;
  user_username: string;
  client_display_name: string;
  service: number;
  service_name: string;
  date: string;
  time: string;
  status: string;
  payment_status?: string;
};

// Réel : /api/services/ → contient bien price et duration (minutes)
type ApiService = {
  id: number;
  name: string;
  price: string;
  duration?: number;
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Non payé',
  paid_onsite: 'Payé au salon',
  paid_online: 'Payé en ligne',
};

const MOCK_CA_DATA: Record<Period, CaPeriodData> = {
  jour: {
    total: '487,50 €',
    bars: [
      { label: '9h', v: 45 },
      { label: '10h', v: 90 },
      { label: '11h', v: 75 },
      { label: '12h', v: 30 },
      { label: '14h', v: 120 },
      { label: '15h', v: 87 },
      { label: '16h', v: 40 },
    ],
    active: '14h',
  },
  semaine: {
    total: '2 840 €',
    bars: [
      { label: 'Lun', v: 0 },
      { label: 'Mar', v: 520 },
      { label: 'Mer', v: 480 },
      { label: 'Jeu', v: 610 },
      { label: 'Ven', v: 590 },
      { label: 'Sam', v: 640 },
      { label: 'Dim', v: 0 },
    ],
    active: 'Sam',
  },
  mois: {
    total: '12 233,23 €',
    bars: [
      { label: 'Jan', v: 30 },
      { label: 'Fév', v: 20 },
      { label: 'Mar', v: 38 },
      { label: 'Avr', v: 42 },
      { label: 'Mai', v: 52 },
      { label: 'Juin', v: 30 },
      { label: 'Juil', v: 33 },
    ],
    active: 'Mar',
  },
};

const MOCK_TOP_SERVICES: TopServiceWithCount[] = [
  { name: 'Signature WilloBarber', pct: 38, count: 148 },
  { name: 'Taille & rasage', pct: 25, count: 96 },
  { name: 'Le Rituel', pct: 17, count: 64 },
  { name: 'Coupe express', pct: 12, count: 48 },
  { name: 'Soin du visage', pct: 8, count: 30 },
];

const MOCK_UPCOMING_CLIENTS: UpcomingClient[] = [
  { id: -1, letter: 'A', name: 'Antoine Rivière', service: 'Signature', barber: 'Willo', time: '10:30' },
  { id: -2, letter: 'K', name: 'Karim Benali', service: 'Barbe', barber: 'Malik', time: '11:15' },
  { id: -3, letter: 'L', name: 'Léo Martin', service: 'Le Rituel', barber: 'Willo', time: '14:00' },
  { id: -4, letter: 'N', name: 'Noé Vasseur', service: 'Camouflage', barber: 'Idris', time: '16:30' },
];

const MOCK_STATS = { clientsTotal: 2412, prestationsCount: 14, equipeCount: 3, rdvCount: 386, rdvCountMonth: 386 };

const MOCK_ANALYTICS: AnalyticsData = {
  peakHour: { label: '14h00', count: 8, pct: 80 },
  bestDay: { label: 'Samedi', total: 1240 },
  topBarber: { name: 'Willo', count: 9, revenue: 382 },
  topClient: { name: 'Sophie Lebrun', count: 10 },
};

function parseApiDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function fmtEuro(n: number): string {
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

// Le backend peut renvoyer un username brut (ex: "sophie_lebrun") en fallback
// quand first_name/last_name sont vides côté User — on le reformate en nom lisible.
function formatDisplayName(raw: string): string {
  if (!raw || !raw.includes('_')) return raw;
  return raw
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function useDashboardData() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(MOCK_STATS);
  const [upcomingClients, setUpcomingClients] = useState<UpcomingClient[]>(MOCK_UPCOMING_CLIENTS);
  const [caData, setCaData] = useState<Record<Period, CaPeriodData>>(MOCK_CA_DATA);
  const [topServices, setTopServices] = useState<TopServiceWithCount[]>(MOCK_TOP_SERVICES);
  const [moisBarsReport, setMoisBarsReport] = useState(MOCK_CA_DATA.mois.bars);
  const [analytics, setAnalytics] = useState<AnalyticsData>(MOCK_ANALYTICS);
  const [exportReservations, setExportReservations] = useState<ExportReservation[]>([]);
  const [exportServices, setExportServices] = useState<ApiService[]>([]);
  // undefined = pas encore lu dans AsyncStorage, null = lu mais absent, string = token trouvé
  const [token, setToken] = useState<string | null | undefined>(undefined);

  // Le token du gérant est stocké sous 'coiffeur_token' (cf. app/coiffeur/index.tsx),
  // pas 'accessToken' qui n'est jamais écrit nulle part dans l'app.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await AsyncStorage.getItem('coiffeur_token');
      console.log('TOKEN DASHBOARD:', t);
      if (!cancelled) setToken(t);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Le fetch attend que le token ait été lu (même s'il est null) avant de partir,
    // pour éviter de fetcher sans Authorization juste parce que AsyncStorage n'avait
    // pas encore répondu au premier rendu.
    if (token === undefined) return;

    let cancelled = false;

    const attemptFetch = async (): Promise<boolean> => {
      try {
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

        // Pas d'endpoint /api/users/ côté backend (confirmé via la page 404 Django,
        // qui liste toutes les routes enregistrées : reservations/, services/,
        // barbershops/, auth/*, appointments/check-client/, recommendations/, boutique/).
        // Le nombre de clients est donc dérivé des clients distincts dans /api/reservations/.
        const [resReservations, resServices] = await Promise.all([
          fetch(`${API_BASE_URL}/api/reservations/`, { headers }),
          fetch(`${API_BASE_URL}/api/services/`, { headers }),
        ]);

        console.log('RESERVATIONS:', resReservations.status, await resReservations.clone().text());
        console.log('SERVICES:', resServices.status, await resServices.clone().text());

        if (!resReservations.ok || !resServices.ok) {
          throw new Error('dashboard-fetch-failed');
        }

        const reservationsRaw = await resReservations.json();
        const servicesRaw = await resServices.json();

        const reservations: ApiReservation[] = Array.isArray(reservationsRaw)
          ? reservationsRaw
          : (reservationsRaw.results ?? []);
        const services: ApiService[] = Array.isArray(servicesRaw) ? servicesRaw : (servicesRaw.results ?? []);
        const clientsTotal: number = new Set(reservations.map((r) => r.user)).size;

        if (cancelled) return true;

        const priceByServiceName: Record<string, number> = {};
        services.forEach((s) => { priceByServiceName[s.name] = parseFloat(s.price) || 0; });

        const activeReservations = reservations.filter((r) => !r.status.startsWith('cancelled'));

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const dayOfWeek = (now.getDay() + 6) % 7; // 0 = lundi
        const monday = new Date(now);
        monday.setHours(0, 0, 0, 0);
        monday.setDate(now.getDate() - dayOfWeek);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const currentYear = now.getFullYear();

        // ── Prochains clients (aujourd'hui) ──
        const realUpcoming: UpcomingClient[] = activeReservations
          .filter((r) => r.date === todayStr)
          .sort((a, b) => a.time.localeCompare(b.time))
          .slice(0, 4)
          .map((r) => ({
            id: r.id,
            letter: (r.client_display_name?.charAt(0) ?? 'W').toUpperCase(),
            name: formatDisplayName(r.client_display_name),
            service: r.service_name,
            barber: 'Willo',
            time: r.time.slice(0, 5),
          }));

        // ── CA jour : groupé par heure ──
        const todayByHour: Record<string, number> = {};
        activeReservations
          .filter((r) => r.date === todayStr)
          .forEach((r) => {
            const hourLabel = `${parseInt(r.time.slice(0, 2), 10)}h`;
            todayByHour[hourLabel] = (todayByHour[hourLabel] ?? 0) + (priceByServiceName[r.service_name] ?? 0);
          });
        const jourBars = Object.entries(todayByHour)
          .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
          .map(([label, v]) => ({ label, v }));
        const jourTotal = jourBars.reduce((sum, b) => sum + b.v, 0);

        // ── CA semaine : groupé par jour de la semaine courante ──
        const weekByDay: Record<string, number> = {};
        activeReservations.forEach((r) => {
          const d = parseApiDate(r.date);
          if (d >= monday && d <= sunday) {
            const label = JOURS_SEMAINE[(d.getDay() + 6) % 7];
            weekByDay[label] = (weekByDay[label] ?? 0) + (priceByServiceName[r.service_name] ?? 0);
          }
        });
        const semaineBars = JOURS_SEMAINE.map((label) => ({ label, v: weekByDay[label] ?? 0 }));
        const semaineTotal = semaineBars.reduce((sum, b) => sum + b.v, 0);

        // ── CA mois : groupé par mois de l'année courante ──
        const yearByMonth: Record<number, number> = {};
        activeReservations.forEach((r) => {
          const d = parseApiDate(r.date);
          if (d.getFullYear() === currentYear) {
            yearByMonth[d.getMonth()] = (yearByMonth[d.getMonth()] ?? 0) + (priceByServiceName[r.service_name] ?? 0);
          }
        });
        const moisBars = MOIS_LABELS.map((label, i) => ({ label, v: yearByMonth[i] ?? 0 }));
        const moisTotal = moisBars.reduce((sum, b) => sum + b.v, 0);

        // ── Top prestations ──
        const countByService: Record<string, number> = {};
        activeReservations.forEach((r) => {
          countByService[r.service_name] = (countByService[r.service_name] ?? 0) + 1;
        });
        const totalRdv = activeReservations.length || 1;
        const realTopServices: TopServiceWithCount[] = Object.entries(countByService)
          .map(([name, count]) => ({ name, pct: Math.round((count / totalRdv) * 100), count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // ── Heure de pointe : quelle heure a le plus de RDV ──
        const countByHour: Record<string, number> = {};
        activeReservations.forEach((r) => {
          const hourLabel = `${parseInt(r.time.slice(0, 2), 10)}h00`;
          countByHour[hourLabel] = (countByHour[hourLabel] ?? 0) + 1;
        });
        const peakHourEntry = Object.entries(countByHour).sort((a, b) => b[1] - a[1])[0];
        const peakHour = peakHourEntry
          ? { label: peakHourEntry[0], count: peakHourEntry[1], pct: Math.round((peakHourEntry[1] / totalRdv) * 100) }
          : null;

        // ── Jour de la semaine le plus rentable (toutes dates confondues) ──
        const revenueByDay: Record<string, number> = {};
        activeReservations.forEach((r) => {
          const d = parseApiDate(r.date);
          const label = JOURS_SEMAINE_LONG[(d.getDay() + 6) % 7];
          revenueByDay[label] = (revenueByDay[label] ?? 0) + (priceByServiceName[r.service_name] ?? 0);
        });
        const bestDayEntry = Object.entries(revenueByDay).sort((a, b) => b[1] - a[1])[0];
        const bestDay = bestDayEntry ? { label: bestDayEntry[0], total: bestDayEntry[1] } : null;

        // ── Barbier top performer ──
        // Pas de champ barbier côté API (cf. commentaire fallback dans planning.tsx) :
        // chaque réservation est rattachée au barbier par défaut 'Willo'.
        const topBarber = activeReservations.length > 0
          ? {
              name: 'Willo',
              count: activeReservations.length,
              revenue: activeReservations.reduce((sum, r) => sum + (priceByServiceName[r.service_name] ?? 0), 0),
            }
          : null;

        // ── Client le plus fidèle (nombre de réservations) ──
        const countByClient: Record<string, number> = {};
        activeReservations.forEach((r) => {
          countByClient[r.client_display_name] = (countByClient[r.client_display_name] ?? 0) + 1;
        });
        const topClientEntry = Object.entries(countByClient).sort((a, b) => b[1] - a[1])[0];
        const topClient = topClientEntry
          ? { name: formatDisplayName(topClientEntry[0]), count: topClientEntry[1] }
          : null;

        // ── Rendez-vous ce mois (pour le rapport PDF) ──
        const rdvCountMonth = activeReservations.filter((r) => {
          const d = parseApiDate(r.date);
          return d.getFullYear() === currentYear && d.getMonth() === now.getMonth();
        }).length;

        if (cancelled) return true;

        setStats({
          clientsTotal,
          prestationsCount: services.length,
          equipeCount: 3, // pas d'endpoint équipe : fallback
          rdvCount: reservations.length,
          rdvCountMonth,
        });
        setUpcomingClients(realUpcoming.length > 0 ? realUpcoming : MOCK_UPCOMING_CLIENTS);
        setCaData({
          jour: { total: fmtEuro(jourTotal), bars: jourBars, active: `${now.getHours()}h` },
          semaine: { total: fmtEuro(semaineTotal), bars: semaineBars, active: JOURS_SEMAINE[dayOfWeek] },
          mois: { total: fmtEuro(moisTotal), bars: moisBars, active: MOIS_LABELS[now.getMonth()] },
        });
        setTopServices(realTopServices.length > 0 ? realTopServices : MOCK_TOP_SERVICES);
        // Le PDF a un graphique en barres à largeur fixe (7 colonnes) : on ne peut pas y
        // faire tenir les 12 mois sans casser la mise en page — on garde les 7 premiers.
        setMoisBarsReport(moisBars.slice(0, 7));
        setAnalytics(
          peakHour && bestDay && topBarber && topClient
            ? { peakHour, bestDay, topBarber, topClient }
            : MOCK_ANALYTICS
        );
        setExportReservations(
          reservations.map((r) => ({ ...r, price: priceByServiceName[r.service_name] ?? 0 }))
        );
        setExportServices(services);
        return true;
      } catch (error) {
        console.log('ERREUR DASHBOARD:', error);
        // Erreur API ou pas de token → on garde les données mock déjà en state par défaut.
        return false;
      }
    };

    (async () => {
      const ok = await attemptFetch();
      if (!ok && !cancelled) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!cancelled) await attemptFetch();
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [token]);

  return {
    loading,
    stats,
    upcomingClients,
    caData,
    topServices,
    moisBarsReport,
    analytics,
    exportReservations,
    exportServices,
  };
}

function useProductStock() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [updatingProductId, setUpdatingProductId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await AsyncStorage.getItem('coiffeur_token');
      if (!cancelled) setToken(t);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (token === undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/boutique/produits/`);
        if (!res.ok) throw new Error(`products-fetch-failed-${res.status}`);
        const data: ApiProduct[] = await res.json();
        if (!cancelled) setProducts(data);
      } catch (error) {
        console.log('ERREUR STOCK PRODUITS:', error);
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const ajusterStock = async (product: ApiProduct, delta: number) => {
    if (!token) return;
    const nextStock = Math.max(0, product.stock + delta);
    if (nextStock === product.stock) return;

    setUpdatingProductId(product.id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/boutique/produits/${product.id}/stock/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stock: nextStock }),
      });
      if (!res.ok) throw new Error(`stock-update-failed-${res.status}`);
      const updated: ApiProduct = await res.json();
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (error) {
      console.log('ERREUR MISE À JOUR STOCK:', error);
    } finally {
      setUpdatingProductId(null);
    }
  };

  return { products, loadingProducts, updatingProductId, ajusterStock };
}

const EXPORT_PDF_URL = 'https://willobarber-production-6951.up.railway.app/api/export/pdf/';
const EXPORT_EXCEL_URL = 'https://willobarber-production-6951.up.railway.app/api/export/excel/';

// Natif : le JWT doit partir dans le header de la requête de téléchargement
// elle-même (WebBrowser ne peut pas y attacher de header), donc on télécharge
// d'abord le fichier sur le disque via FileSystem, puis on le partage —
// même pattern que la facture dans BookingConfirmation.tsx.
async function downloadAndShare(url: string, filename: string, mimeType: string) {
  const token = await AsyncStorage.getItem('coiffeur_token');
  const destination = new File(Paths.cache, filename);
  // File.downloadFileAsync est attaché au runtime (expo-file-system/src/FileSystem.ts)
  // mais absent des déclarations de types de cette version du SDK — cf. le même
  // contournement utilisé dans BookingConfirmation.tsx / ClientMediaGrid.tsx.
  const downloaded = await (File as any).downloadFileAsync(url, destination, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    idempotent: true,
  });
  const fileUri: string = downloaded.uri;

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType });
  } else {
    await WebBrowser.openBrowserAsync(fileUri);
  }
}

type RapportData = {
  clientsTotal: number;
  prestationsCount: number;
  equipeCount: number;
  rdvCountMonth: number;
  caTotal: string;
  moisBars: { label: string; v: number }[];
  moisActive: string;
  topServices: TopServiceWithCount[];
  clients: UpcomingClient[];
};

async function genererRapport(data: RapportData) {
  if (Platform.OS !== 'web' || !jsPDF) {
    await downloadAndShare(EXPORT_PDF_URL, 'rapport_willobarber.pdf', 'application/pdf');
    return;
  }

  const doc = new jsPDF();
  const gold: [number, number, number] = [139, 105, 20];
  const dark: [number, number, number] = [26, 18, 8];
  const gray: [number, number, number] = [138, 132, 124];
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // Header fond noir
  doc.setFillColor(13, 12, 10);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(...gold);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('willobarber', 15, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text('RAPPORT DE GESTION', 15, 28);
  doc.text(date + ' · ' + heure, 15, 35);

  let y = 52;

  // Section helper
  const section = (titre: string) => {
    doc.setFillColor(245, 240, 232);
    doc.rect(10, y - 5, 190, 8, 'F');
    doc.setTextColor(...gold);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(titre, 15, y);
    y += 10;
  };

  const ligne = (label: string, valeur: string) => {
    doc.setTextColor(...dark);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(label, 15, y);
    doc.setFont('helvetica', 'bold');
    doc.text(valeur, 130, y);
    y += 8;
  };

  // RÉSUMÉ GÉNÉRAL
  section('RÉSUMÉ GÉNÉRAL');
  ligne('Clients totaux', String(data.clientsTotal));
  ligne('Prestations actives', String(data.prestationsCount));
  ligne('Équipe', `${data.equipeCount} barbiers`);
  ligne('Rendez-vous ce mois', String(data.rdvCountMonth));
  y += 6;

  // CHIFFRE D'AFFAIRES
  section("CHIFFRE D'AFFAIRES MENSUEL");
  doc.setTextColor(...gold);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(data.caTotal, 15, y);
  y += 10;

  // Mini bar chart PDF
  const bars: { label: string; v: number; active?: boolean }[] = data.moisBars.map((b) => ({
    ...b,
    active: b.label === data.moisActive,
  }));
  const maxV = Math.max(...bars.map((b) => b.v), 1);
  const barW = 18;
  const barMaxH = 30;
  const startX = 15;
  bars.forEach((b, i) => {
    const bh = (b.v / maxV) * barMaxH;
    const bx = startX + i * (barW + 5);
    const by = y + barMaxH - bh;
    doc.setFillColor(b.active ? 201 : 236, b.active ? 168 : 228, b.active ? 76 : 211);
    doc.roundedRect(bx, by, barW, bh, 2, 2, 'F');
    doc.setTextColor(...gray);
    doc.setFontSize(7);
    doc.setFont('helvetica', b.active ? 'bold' : 'normal');
    if (b.active) doc.setTextColor(...gold);
    doc.text(b.label, bx + barW / 2, y + barMaxH + 5, { align: 'center' });
  });
  y += barMaxH + 14;

  // TOP PRESTATIONS
  section('TOP PRESTATIONS');
  const tops = data.topServices.map((s, i) => ({
    rank: String(i + 1),
    name: s.name,
    pct: `${s.pct}%`,
    rdv: `${s.count} RDV`,
  }));
  tops.forEach((t) => {
    doc.setFillColor(...gold);
    doc.roundedRect(15, y - 4, 6, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(t.rank, 18, y, { align: 'center' });
    doc.setTextColor(...dark);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(t.name, 25, y);
    doc.setTextColor(...gold);
    doc.setFont('helvetica', 'bold');
    doc.text(t.pct, 150, y);
    doc.setTextColor(...gray);
    doc.setFont('helvetica', 'normal');
    doc.text(t.rdv, 170, y);
    // Barre progression
    doc.setFillColor(240, 234, 223);
    doc.rect(25, y + 2, 120, 2, 'F');
    doc.setFillColor(...gold);
    doc.rect(25, y + 2, (120 * parseInt(t.pct, 10)) / 100, 2, 'F');
    y += 12;
  });
  y += 4;

  // PROCHAINS CLIENTS
  section("PROCHAINS CLIENTS AUJOURD'HUI");
  const clients = data.clients.map((c) => ({
    time: c.time,
    name: c.name,
    svc: `${c.service} · ${c.barber}`,
  }));
  clients.forEach((c, i) => {
    if (i > 0) {
      doc.setDrawColor(240, 234, 223);
      doc.line(15, y - 2, 195, y - 2);
    }
    doc.setTextColor(...gold);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(c.time, 15, y);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text(c.name, 40, y);
    doc.setTextColor(...gray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(c.svc, 40, y + 5);
    y += 14;
  });

  // Footer
  doc.setFillColor(13, 12, 10);
  doc.rect(0, 280, 210, 17, 'F');
  doc.setTextColor(...gold);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('willobarber', 15, 288);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.text('Rue Auguste Van Zande 78, 1082 Bruxelles', 15, 293);
  doc.setTextColor(...gray);
  doc.text('Généré le ' + date + ' à ' + heure, 195, 293, { align: 'right' });

  doc.save(`rapport-willobarber-${new Date().toISOString().split('T')[0]}.pdf`);
}

type ExcelData = {
  reservations: ExportReservation[];
  services: ApiService[];
  analytics: AnalyticsData;
  caTotal: string;
  clientsTotal: number;
  rdvCount: number;
};

async function genererExcel(data: ExcelData) {
  // XLSX.writeFile() déclenche un téléchargement via des API navigateur
  // (Blob, document.createElement('a')) indisponibles sur iOS/Android natif.
  if (Platform.OS !== 'web') {
    await downloadAndShare(
      EXPORT_EXCEL_URL,
      'willobarber.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    return;
  }

  // ── Onglet Réservations ──
  const reservationsRows = data.reservations.map((r) => ({
    ID: r.id,
    Client: formatDisplayName(r.client_display_name),
    Service: r.service_name,
    Date: r.date,
    Heure: r.time.slice(0, 5),
    'Montant (€)': r.price,
    'Statut paiement': PAYMENT_STATUS_LABELS[r.payment_status ?? ''] ?? r.payment_status ?? '—',
  }));

  // ── Onglet Services ──
  const countByService: Record<string, number> = {};
  const revenueByService: Record<string, number> = {};
  data.reservations.forEach((r) => {
    countByService[r.service_name] = (countByService[r.service_name] ?? 0) + 1;
    revenueByService[r.service_name] = (revenueByService[r.service_name] ?? 0) + r.price;
  });
  const servicesRows = data.services.map((s) => ({
    Nom: s.name,
    'Prix (€)': parseFloat(s.price) || 0,
    'Durée (min)': s.duration ?? '—',
    'Nombre de réservations': countByService[s.name] ?? 0,
    'CA généré (€)': revenueByService[s.name] ?? 0,
  }));

  // ── Onglet Analytics ──
  const analyticsRows = [
    { Indicateur: 'Heure de pointe', Valeur: `${data.analytics.peakHour.label} — ${data.analytics.peakHour.count} RDV` },
    { Indicateur: 'Jour le plus rentable', Valeur: `${data.analytics.bestDay.label} — ${fmtEuro(data.analytics.bestDay.total)}` },
    { Indicateur: "Chiffre d'affaires total", Valeur: data.caTotal },
    { Indicateur: 'Nombre de clients', Valeur: String(data.clientsTotal) },
    { Indicateur: 'Nombre de RDV', Valeur: String(data.rdvCount) },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reservationsRows), 'Réservations');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(servicesRows), 'Services');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analyticsRows), 'Analytics');

  XLSX.writeFile(wb, `dashboard-willobarber-${new Date().toISOString().split('T')[0]}.xlsx`);
}

export default function CoiffeurDashboardScreen() {
  const isTablet = useIsTablet();
  const [period, setPeriod] = useState<Period>('mois');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const periodBtnRef = useRef<View>(null);
  const {
    loading,
    stats,
    upcomingClients,
    caData,
    topServices,
    moisBarsReport,
    analytics,
    exportReservations,
    exportServices,
  } = useDashboardData();
  const { products, loadingProducts, updatingProductId, ajusterStock } = useProductStock();

  const periodData = caData[period];
  const maxValue = Math.max(...periodData.bars.map((b) => b.v), 1);

  const selectPeriod = (p: Period) => {
    setPeriod(p);
    setMenuOpen(false);
  };

  const togglePeriodMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    periodBtnRef.current?.measureInWindow((x, y, _width, height) => {
      setMenuPos({ top: y + height + 6, left: x });
      setMenuOpen(true);
    });
  };

  const handleGenererRapport = async () => {
    await genererRapport({
      clientsTotal: stats.clientsTotal,
      prestationsCount: stats.prestationsCount,
      equipeCount: stats.equipeCount,
      rdvCountMonth: stats.rdvCountMonth,
      caTotal: caData.mois.total,
      moisBars: moisBarsReport,
      moisActive: caData.mois.active,
      topServices,
      clients: upcomingClients,
    });
  };

  const handleExporterExcel = async () => {
    await genererExcel({
      reservations: exportReservations,
      services: exportServices,
      analytics,
      caTotal: caData.mois.total,
      clientsTotal: stats.clientsTotal,
      rdvCount: stats.rdvCount,
    });
  };

  return (
    <>
    <CoiffeurScreen active="dashboard">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Aperçu</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.reportBtn} onPress={handleGenererRapport}>
            <DownloadIcon color={CC.black} size={13} />
            <Text style={styles.reportBtnText}>Rapport</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reportBtn} onPress={handleExporterExcel}>
            <Text style={styles.reportBtnText}>📊 Excel</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.statCardDark, isTablet && styles.statCardTablet]}>
          <UsersIcon color={CC.white} size={18} />
          <Text style={styles.statLabelDark}>Clients totaux</Text>
          <Text style={styles.statValueDark}>{loading ? '--' : stats.clientsTotal}</Text>
        </View>
        <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
          <ListIcon color={CC.black} size={18} />
          <Text style={styles.statLabel}>Prestations</Text>
          <Text style={styles.statValue}>{loading ? '--' : stats.prestationsCount}</Text>
        </View>
        <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
          <PersonIcon color={CC.black} size={18} />
          <Text style={styles.statLabel}>Équipe</Text>
          <Text style={styles.statValue}>{loading ? '--' : stats.equipeCount}</Text>
        </View>
        <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
          <CalendarIcon color={CC.black} size={18} />
          <Text style={styles.statLabel}>Rendez-vous</Text>
          <Text style={styles.statValue}>{loading ? '--' : stats.rdvCount}</Text>
        </View>
      </View>

      <View style={isTablet && styles.twoColRow}>
        <View style={[styles.card, isTablet && styles.cardHalf]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Chiffre d'affaires</Text>
            <View ref={periodBtnRef} collapsable={false}>
              <TouchableOpacity style={styles.periodBtn} onPress={togglePeriodMenu}>
                <Text style={styles.periodBtnText}>{PERIOD_LABELS[period]}</Text>
                <ChevronDownIcon size={12} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.revenueAmount}>{periodData.total}</Text>

          <View style={styles.chart}>
            {periodData.bars.map((bar) => {
              const isActive = bar.label === periodData.active;
              return (
                <View key={bar.label} style={styles.chartCol}>
                  <View style={styles.chartBarTrack}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: (bar.v / maxValue) * 130,
                          backgroundColor: isActive ? CC.gold : CC.barTrackBg,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.chartLabel, isActive && styles.chartLabelActive]}>{bar.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, isTablet && styles.cardHalf]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Top prestations</Text>
            <TouchableOpacity onPress={() => router.push('/coiffeur/prestations')}>
              <Text style={styles.linkText}>Voir tout →</Text>
            </TouchableOpacity>
          </View>

          {topServices.map((s, i) => (
            <View key={s.name} style={styles.topServiceRow}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>{i + 1}</Text>
              </View>
              <View style={styles.topServiceInfo}>
                <View style={styles.topServiceTop}>
                  <Text style={styles.topServiceName}>{s.name}</Text>
                  <Text style={styles.topServicePct}>{s.pct}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${s.pct}%` }]} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
          <CalendarIcon color={CC.black} size={18} />
          <Text style={styles.statLabel}>Heure de pointe</Text>
          <Text style={styles.analyticsValue}>
            {analytics.peakHour.label} — {analytics.peakHour.count} RDV
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${analytics.peakHour.pct}%` }]} />
          </View>
        </View>
        <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
          <ListIcon color={CC.black} size={18} />
          <Text style={styles.statLabel}>Jour le plus rentable</Text>
          <Text style={styles.analyticsValue}>
            {analytics.bestDay.label} — {fmtEuro(analytics.bestDay.total)}
          </Text>
        </View>
        <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
          <PersonIcon color={CC.black} size={18} />
          <Text style={styles.statLabel}>Barbier top performer</Text>
          <Text style={styles.analyticsValue}>
            {analytics.topBarber.name} — {analytics.topBarber.count} RDV — {fmtEuro(analytics.topBarber.revenue)}
          </Text>
        </View>
        <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
          <UsersIcon color={CC.black} size={18} />
          <Text style={styles.statLabel}>Client le plus fidèle</Text>
          <Text style={styles.analyticsValue}>
            {analytics.topClient.name} — {analytics.topClient.count} visites
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Prochains clients</Text>
          <TouchableOpacity onPress={() => router.push('/coiffeur/planning')}>
            <Text style={styles.linkText}>Agenda →</Text>
          </TouchableOpacity>
        </View>

        {upcomingClients.map((c, i) => (
          <View key={c.id} style={[styles.clientRow, i === upcomingClients.length - 1 && styles.clientRowLast]}>
            <Avatar letter={c.letter} size={40} />
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{c.name}</Text>
              <Text style={styles.clientMeta}>
                {c.service} · {c.barber}
              </Text>
            </View>
            <Text style={styles.clientTime}>{c.time}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>🛍️ Stock Produits</Text>
        </View>

        {loadingProducts ? (
          <Text style={styles.stockEmpty}>Chargement…</Text>
        ) : products.length === 0 ? (
          <Text style={styles.stockEmpty}>Aucun produit.</Text>
        ) : (
          products.map((p, i) => {
            const outOfStock = p.stock === 0;
            const lowStock = !outOfStock && p.stock <= p.stock_alert;
            const updating = updatingProductId === p.id;
            return (
              <View key={p.id} style={[styles.stockRow, i === products.length - 1 && styles.clientRowLast]}>
                <View style={styles.stockInfo}>
                  <Text style={styles.stockName}>{p.nom}</Text>
                  {outOfStock ? (
                    <View style={styles.stockBadgeOut}>
                      <Text style={styles.stockBadgeOutText}>Rupture</Text>
                    </View>
                  ) : lowStock ? (
                    <View style={styles.stockBadgeLow}>
                      <Text style={styles.stockBadgeLowText}>Stock faible !</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.stockControls}>
                  <TouchableOpacity
                    style={[styles.stockBtn, (updating || p.stock === 0) && styles.stockBtnDisabled]}
                    onPress={() => ajusterStock(p, -1)}
                    disabled={updating || p.stock === 0}
                  >
                    <Text style={styles.stockBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stockValue}>{p.stock}</Text>
                  <TouchableOpacity
                    style={[styles.stockBtn, updating && styles.stockBtnDisabled]}
                    onPress={() => ajusterStock(p, 1)}
                    disabled={updating}
                  >
                    <Text style={styles.stockBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>
    </CoiffeurScreen>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
        <View style={[styles.periodMenu, { top: menuPos.top, left: menuPos.left }]}>
          {PERIODS.map((p) => {
            const isActive = p === period;
            return (
              <TouchableOpacity key={p} style={styles.periodMenuItem} onPress={() => selectPeriod(p)}>
                <Text style={[styles.periodMenuItemText, isActive && styles.periodMenuItemTextActive]}>
                  {PERIOD_LABELS[p]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  title: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 32,
    color: CC.black,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CC.gold,
    borderRadius: 100,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  reportBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: CC.black,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statCard: {
    width: '47%',
    backgroundColor: CC.white,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginBottom: 12,
    borderWidth: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  statCardTablet: {
    width: '23%',
  },
  statCardDark: {
    backgroundColor: CC.cardBlack,
  },
  statLabel: {
    fontSize: 12.5,
    color: CC.textSecondary,
  },
  statLabelDark: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.6)',
  },
  analyticsValue: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 17,
    color: CC.goldDark,
  },
  statValue: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 30,
    color: CC.black,
  },
  statValueDark: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 30,
    color: CC.white,
  },
  card: {
    backgroundColor: CC.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 16,
  },
  cardHalf: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 19,
    color: CC.black,
  },
  periodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: CC.white,
  },
  periodBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: CC.black,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  periodMenu: {
    position: 'absolute',
    minWidth: 130,
    backgroundColor: CC.white,
    borderRadius: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  periodMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  periodMenuItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: CC.black,
  },
  periodMenuItemTextActive: {
    color: CC.goldDark,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: CC.goldDark,
  },
  revenueAmount: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 32,
    color: CC.black,
    marginBottom: 18,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  chartCol: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarTrack: {
    height: 130,
    justifyContent: 'flex-end',
    width: '60%',
  },
  chartBar: {
    width: '100%',
    borderRadius: 5,
  },
  chartLabel: {
    fontSize: 11,
    color: CC.textSecondary,
    marginTop: 8,
  },
  chartLabelActive: {
    color: CC.goldDark,
    fontWeight: '700',
  },
  topServiceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 14,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: 'rgba(201,168,76,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    color: CC.goldDark,
    fontWeight: '700',
    fontSize: 12,
  },
  topServiceInfo: {
    flex: 1,
  },
  topServiceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  topServiceName: {
    fontSize: 14,
    fontWeight: '600',
    color: CC.black,
  },
  topServicePct: {
    fontSize: 12.5,
    color: CC.textSecondary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: CC.trackBg,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: CC.gold,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0eadf',
  },
  clientRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: CC.black,
  },
  clientMeta: {
    fontSize: 12.5,
    color: CC.textSecondary,
    marginTop: 2,
  },
  clientTime: {
    fontSize: 14,
    fontWeight: '700',
    color: CC.black,
  },

  stockEmpty: {
    fontSize: 13,
    color: CC.textSecondary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0eadf',
  },
  stockInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stockName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: CC.black,
  },
  stockBadgeLow: {
    backgroundColor: CC.errorBg,
    borderRadius: 100,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  stockBadgeLowText: {
    fontSize: 11,
    fontWeight: '700',
    color: CC.errorText,
  },
  stockBadgeOut: {
    backgroundColor: CC.grayBg,
    borderRadius: 100,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  stockBadgeOutText: {
    fontSize: 11,
    fontWeight: '700',
    color: CC.grayText,
  },
  stockControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stockBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CC.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CC.white,
  },
  stockBtnDisabled: {
    opacity: 0.4,
  },
  stockBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: CC.black,
  },
  stockValue: {
    fontSize: 15,
    fontWeight: '700',
    color: CC.black,
    minWidth: 24,
    textAlign: 'center',
  },
});
