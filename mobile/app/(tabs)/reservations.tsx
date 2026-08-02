import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableNativeFeedback,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useReservations } from '@/hooks/useReservations';
import type { Reservation, Review } from '@/types';
import { Fonts } from '@/constants';
import { useIsTablet } from '@/components/client/useIsTablet';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TranslationKey } from '@/i18n/translations';
import { fmtPrice } from '@/components/booking/data';
import { useClientMedia } from '@/hooks/useClientMedia';
import ClientMediaGrid from '@/components/media/ClientMediaGrid';
import ReviewCard from '@/components/client/ReviewCard';
import { reviewsApi } from '@/services/api';

const MOIS_ABBR_FR = ['JANV', 'FÉVR', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];
const MOIS_FR_FULL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS_ABBR_FR = ['DIM.', 'LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.'];

const PRICE_BY_SERVICE_NAME: Record<string, number> = {
  'Signature WilloBarber': 45,
  "Taille & rasage à l'ancienne": 28,
  'Le Rituel': 75,
  'Coupe express': 28,
  'Camouflage gris': 35,
  'Soin du visage': 32,
  'Coupe enfant −15 ans': 15,
  'Coupe enfant +15 ans': 20,
};

function parseApiDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatHmm(timeStr: string): string {
  return timeStr.slice(0, 5).replace(':', 'h');
}

const MOCK_LOYALTY = {
  points: 980,
  total_earned: 1480,
};

const TRANSACTIONS_META: { id: number; date?: string; dateKey?: TranslationKey; reasonKey: TranslationKey; points: number; type: string }[] = [
  { id: 1, date: '13 juil. 2026', reasonKey: 'reservations.tx.signature', points:   90, type: 'earn'  },
  { id: 2, date: '03 juin 2026',  reasonKey: 'reservations.tx.rituel',    points:  150, type: 'earn'  },
  { id: 3, date: '20 mai 2026',   reasonKey: 'reservations.tx.freeCut',   points: -1000, type: 'spend' },
  { id: 4, date: '05 mai 2026',   reasonKey: 'reservations.tx.rasage',    points:   56, type: 'earn'  },
  { id: 5, dateKey: 'reservations.tx.welcomeLabel', reasonKey: 'reservations.tx.welcomeReason', points: 20, type: 'bonus' },
];

const TIERS_META = [
  { labelKey: 'reservations.loyalty.tier.bronze' as TranslationKey, min: 0,   threshold: '0',   color: '#8B6914' },
  { labelKey: 'reservations.loyalty.tier.argent' as TranslationKey, min: 200, threshold: '200', color: '#6B6560' },
  { labelKey: 'reservations.loyalty.tier.or' as TranslationKey,     min: 500, threshold: '500', color: '#C9A84C' },
];

const HISTORIQUE_META = [
  { jour: '12', mois: 'AVR',  serviceKey: 'reservations.hist.signature' as TranslationKey, barbier: 'W', barbierNom: 'Willo', couleur: '#C9A84C', prix: '45€', annee: '2026' },
  { jour: '02', mois: 'MARS', serviceKey: 'reservations.hist.taille' as TranslationKey,     barbier: 'M', barbierNom: 'Malik', couleur: '#7A3B1E', prix: '28€', annee: '2026' },
  { jour: '18', mois: 'JANV', serviceKey: 'reservations.hist.rituel' as TranslationKey,     barbier: 'W', barbierNom: 'Willo', couleur: '#C9A84C', prix: '75€', annee: '2026' },
  { jour: '05', mois: 'DÉC',  serviceKey: 'reservations.hist.express' as TranslationKey,    barbier: 'I', barbierNom: 'Idris', couleur: '#1A6B4A', prix: '28€', annee: '2025' },
];

const FAVORIS_META = [
  { nomKey: 'reservations.hist.signature' as TranslationKey, dur: '45 min', prix: '45€', count: '8×', date: '12 avr.' },
  { nomKey: 'reservations.hist.taille' as TranslationKey,    dur: '30 min', prix: '28€', count: '5×', date: '2 mars'  },
];

const NEXT_RDV = {
  dateLabel: '23 mai 2026',
  dateShort: '23 MAI',
  time:      '10:30',
  timeLabel: '10h30',
  barbier:   'Willo',
  adresse:   'Rue Auguste Van Zande 78',
};

function getNextTarget(pts: number): number {
  if (pts < 200) return 200;
  if (pts < 500) return 500;
  return Math.ceil((pts + 1) / 500) * 500;
}

function getBarProgress(pts: number): number {
  if (pts < 200) return pts / 200;
  if (pts < 500) return (pts - 200) / 300;
  const prev = Math.floor(pts / 500) * 500;
  return (pts - prev) / 500;
}

function GoldItalic({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: '#C9A84C', fontStyle: 'italic', fontFamily: Fonts.italic, fontWeight: '500' }}>
      {children}
    </Text>
  );
}

interface CancelModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}
function CancelModal({ visible, onClose, onConfirm, loading }: CancelModalProps) {
  const [reason, setReason] = useState('');
  const isTablet = useIsTablet();
  const { t } = useLanguage();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, isTablet && styles.modalOverlayTablet]}>
        <View style={[styles.modalBox, isTablet && styles.modalBoxTablet]}>
          <Text style={styles.modalTitle}>{t('reservations.cancelModal.title')}</Text>
          <Text style={styles.modalSub}>{t('reservations.cancelModal.sub')}</Text>
          <Text style={styles.fieldLabel}>{t('reservations.cancelModal.reasonLabel')}</Text>
          <TextInput
            style={styles.modalInput}
            value={reason}
            onChangeText={setReason}
            placeholder={t('reservations.cancelModal.placeholder')}
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
          />
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.btnOutline} onPress={onClose}>
              <Text style={styles.btnOutlineText}>{t('reservations.cancelModal.keep')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnDanger} onPress={() => onConfirm(reason)} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#C0392B" size="small" />
                : <Text style={styles.btnDangerText}>{t('reservations.cancelModal.confirmCancel')}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ReservationsScreen() {
  const router = useRouter();
  const isTablet = useIsTablet();
  const { user, isAuthenticated } = useAuth();
  const { showLoginModal } = useAuthModal();
  const { isLoading, refetch, cancel, upcoming, past, error } = useReservations();
  const { t } = useLanguage();
  const [histFilter, setHistFilter] = useState('Tous');
  const [selectedHistIndex, setSelectedHistIndex] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [mainTab, setMainTab] = useState<'apercu' | 'coupes'>('apercu');
  const barAnim = useRef(new Animated.Value(0)).current;
  const { media: myMedia, isLoading: myMediaLoading } = useClientMedia(user?.id ?? null);

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  useEffect(() => {
    if (!isLoading) setHasLoadedOnce(true);
  }, [isLoading]);
  const showInitialLoader = isLoading && !hasLoadedOnce;

  // L'API /reservations/ retourne un champ 'time', absent du type Reservation partagé
  // (utilisé ailleurs avec un shape différent) — on type le réel localement ici.
  const upcomingList = upcoming as (Reservation & { time: string })[];
  const pastList = past as (Reservation & { time: string })[];

  const nextReservation = [...upcomingList].sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
  )[0] ?? null;

  const pastSorted = [...pastList].sort((a, b) =>
    `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)
  );

  const [myReviews, setMyReviews] = useState<Review[]>([]);
  useEffect(() => {
    if (!isAuthenticated) return;
    reviewsApi.mine().then(setMyReviews).catch(() => {});
  }, [isAuthenticated]);

  const reviewForReservation = (reservationId: number) =>
    myReviews.find((rv) => rv.reservation === reservationId) ?? null;

  const handleReviewSubmitted = (review: Review) => {
    setMyReviews((prev) => [...prev, review]);
  };

  const nextRdvView = nextReservation ? (() => {
    const d = parseApiDate(nextReservation.date);
    return {
      jour: String(d.getDate()).padStart(2, '0'),
      mois: MOIS_ABBR_FR[d.getMonth()],
      jourAbbr: JOURS_ABBR_FR[d.getDay()],
      service: nextReservation.service_name,
      time: nextReservation.time.slice(0, 5),
      timeLabel: formatHmm(nextReservation.time),
      barbier: 'Willo',
      dateLabel: `${d.getDate()} ${MOIS_FR_FULL[d.getMonth()]} ${d.getFullYear()}`,
      dateShort: `${d.getDate()} ${MOIS_ABBR_FR[d.getMonth()]}`,
    };
  })() : null;

  const rdv = nextRdvView ?? {
    jour: '23',
    mois: t('reservations.mockRdv.monthAbbr'),
    jourAbbr: t('reservations.mockRdv.dayAbbr'),
    service: null as string | null,
    time: '10:30',
    timeLabel: '10:30',
    barbier: NEXT_RDV.barbier,
    dateLabel: NEXT_RDV.dateLabel,
    dateShort: NEXT_RDV.dateShort,
  };

  const TRANSACTIONS = TRANSACTIONS_META.map(tx => ({
    ...tx,
    date: tx.dateKey ? t(tx.dateKey) : tx.date!,
    reason: t(tx.reasonKey),
  }));

  const TIERS = TIERS_META.map(tier => ({
    ...tier,
    label: t(tier.labelKey),
    threshold: `${tier.threshold} ${t('reservations.pointsSuffix')}`,
  }));

  const HISTORIQUE = error
    ? HISTORIQUE_META.map(h => ({ ...h, service: t(h.serviceKey), id: null as number | null, status: null as string | null }))
    : pastSorted.map(r => {
        const d = parseApiDate(r.date);
        return {
          jour: String(d.getDate()).padStart(2, '0'),
          mois: MOIS_ABBR_FR[d.getMonth()],
          service: r.service_name,
          barbier: 'W',
          barbierNom: 'Willo',
          couleur: '#C9A84C',
          prix: fmtPrice(PRICE_BY_SERVICE_NAME[r.service_name] ?? 0),
          annee: r.date.slice(0, 4),
          id: r.id as number | null,
          status: r.status as string | null,
        };
      });

  const FAVORIS = FAVORIS_META.map(f => ({
    ...f,
    nom: t(f.nomKey),
  }));

  const NEXT_RDV_SERVICE_LABEL = `${t('reservations.mockRdv.servicePrefix')} ${t('reservations.mockRdv.serviceGold')}`;

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: getBarProgress(MOCK_LOYALTY.points),
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, []);

  if (!isAuthenticated || !user) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 28 }]}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 10, textAlign: 'center' }}>
          {t('reservations.notAuth.title')}
        </Text>
        <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
          {t('reservations.notAuth.sub')}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#C9A84C', borderRadius: 100, paddingVertical: 15, paddingHorizontal: 40 }}
          onPress={() => showLoginModal(undefined, t('reservations.notAuth.loginPrompt'))}
          activeOpacity={0.85}
        >
          <Text style={{ color: '#1A1208', fontWeight: '700', fontSize: 15 }}>{t('common.login')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const username = user?.username || user?.first_name || 'Client';
  const nextTarget  = getNextTarget(MOCK_LOYALTY.points);
  const ptsRestants = nextTarget - MOCK_LOYALTY.points;

  const mainTabsRow = (
    <View style={styles.mainTabsRow}>
      <Pressable
        style={[styles.mainTabPill, mainTab === 'apercu' && styles.mainTabPillActive]}
        onPress={() => setMainTab('apercu')}
      >
        <Text style={[styles.mainTabText, mainTab === 'apercu' && styles.mainTabTextActive]}>Aperçu</Text>
      </Pressable>
      <Pressable
        style={[styles.mainTabPill, mainTab === 'coupes' && styles.mainTabPillActive]}
        onPress={() => setMainTab('coupes')}
      >
        <Text style={[styles.mainTabText, mainTab === 'coupes' && styles.mainTabTextActive]}>✂️ Mes coupes</Text>
      </Pressable>
    </View>
  );

  const mesCoupesGallery = (
    <View style={{ marginTop: 8, overflow: 'visible' }}>
      <Text style={styles.sectionTitle}>Mes coupes</Text>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13.5, marginTop: -6, marginBottom: 16 }}>
        Les photos et vidéos avant/après partagées par votre coiffeur.
      </Text>
      <ClientMediaGrid
        media={myMedia}
        isLoading={myMediaLoading}
        emptyLabel="Aucune photo ou vidéo pour le moment."
        mutedColor="rgba(255,255,255,0.5)"
      />
    </View>
  );

  const filteredHist = histFilter === 'Tous'
    ? HISTORIQUE
    : HISTORIQUE.filter(h => h.annee === histFilter);

  const handleCancel = async (reason: string) => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancel(cancelTarget.id, reason);
      setCancelTarget(null);
    } catch {
      if (Platform.OS === 'web') {
        window.alert(`${t('common.error')} : ${t('reservations.cancelError')}`);
      } else {
        Alert.alert(t('common.error'), t('reservations.cancelError'));
      }
    } finally {
      setCancelling(false);
    }
  };

  const handleAddToCalendar = async () => {
    const startDate = nextReservation
      ? `${nextReservation.date.replace(/-/g, '')}T${nextReservation.time.replace(/:/g, '').slice(0, 6)}`
      : '20260523T103000';
    const endDate = nextReservation
      ? `${nextReservation.date.replace(/-/g, '')}T${nextReservation.time.replace(/:/g, '').slice(0, 6)}`
      : '20260523T110000';
    if (Platform.OS === 'web') {
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Coupe+%2B+Barbe+%E2%80%94+WilloBarber&dates=${startDate}/${endDate}&details=Barbier+:+Willo%0AAdresse+:+Rue+Auguste+Van+Zande+78%0ASolde+%C3%A0+payer+au+salon+:+42.70%E2%82%AC&location=Rue+Auguste+Van+Zande+78`;
      window.open(url, '_blank');
      return;
    }
    try {
      const calendarUrl = Platform.OS === 'ios' ? 'calshow://' : 'content://com.android.calendar/time/';
      const canOpen = await Linking.canOpenURL(calendarUrl);
      if (!canOpen) throw new Error('calendar-unavailable');
      await Linking.openURL(calendarUrl);
    } catch {
      Alert.alert(
        t('reservations.calendarAlert.title'),
        `${rdv.service ? rdv.service : NEXT_RDV_SERVICE_LABEL}\n\n📅  ${rdv.dateLabel} ${t('reservations.cancelNextAlert.confirmWebMid')} ${rdv.time}\n${t('reservations.calendarAlert.barberLabel')} ${rdv.barbier}\n📍  ${NEXT_RDV.adresse}`,
        [{ text: t('common.ok') }]
      );
    }
  };

  const handleReprogrammer = () => {
    // Le wizard (/(tabs)/book) ne lit pas encore de params de prestation/barbier : navigation simple.
    router.push('/(tabs)/book');
  };

  const handleCancelNextRdv = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `${t('reservations.cancelNextAlert.confirmWebPrefix')} ${NEXT_RDV.dateShort} ${t('reservations.cancelNextAlert.confirmWebMid')} ${NEXT_RDV.timeLabel} ${t('reservations.cancelNextAlert.confirmWebWith')} ${NEXT_RDV.barbier} ?`
      );
      if (confirmed) {
        window.alert(`${t('reservations.cancelNextAlert.doneTitle')}. ${t('reservations.cancelNextAlert.doneMsg')}`);
      }
      return;
    }
    Alert.alert(
      t('reservations.cancelNextAlert.title'),
      `${t('reservations.cancelNextAlert.confirmWebPrefix')} ${NEXT_RDV.dateShort} ${t('reservations.cancelNextAlert.confirmWebMid')} ${NEXT_RDV.timeLabel} ${t('reservations.cancelNextAlert.confirmWebWith')} ${NEXT_RDV.barbier} ${t('reservations.cancelNextAlert.body')}`,
      [
        { text: t('reservations.cancelNextAlert.cancelBtn'), style: 'cancel' },
        {
          text: t('reservations.cancelNextAlert.confirmBtn'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(t('reservations.cancelNextAlert.doneTitle'), t('reservations.cancelNextAlert.doneMsg'));
          },
        },
      ]
    );
  };

  const handleAdapter = () => router.push('/(tabs)/book');

  const handleRebook = (h: typeof HISTORIQUE[number]) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`${t('reservations.rebookTitle')} ${h.service} ${t('reservations.rebookWith')} ${h.barbierNom} ?`);
      if (confirmed) {
        router.push('/(tabs)/book');
      }
      return;
    }
    // Le wizard (/(tabs)/book) ne lit pas encore de params de prestation/barbier :
    // on informe l'utilisateur avant de le rediriger vers la réservation.
    Alert.alert(
      `${t('reservations.rebookTitle')} ${h.service} ${t('reservations.rebookWith')} ${h.barbierNom}`,
      undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('reservations.rebookGo'), onPress: () => router.push('/(tabs)/book') },
      ]
    );
  };

  const handleReceipt = (h: typeof HISTORIQUE[number], index: number) => {
    const message = `${h.service}\n${h.jour} ${h.mois} · ${h.barbierNom} · ${h.prix}\nN° WB-${h.annee}-${String(index + 1).padStart(5, '0')}`;
    if (Platform.OS === 'web') {
      window.alert(`${t('reservations.receiptTitle')}\n\n${message}`);
      return;
    }
    Alert.alert(t('reservations.receiptTitle'), message, [{ text: t('common.close') }]);
  };

  return (
    <View style={styles.root}>
      {/* Sticky top bar */}
      {!isTablet && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerLogo}>{'{w}'}</Text>
            <Text style={styles.headerBrand}>willobarber</Text>
          </View>
          <View style={[styles.avatar, { width: 32, height: 32, borderRadius: 16 }]}>
            <Text style={[styles.avatarText, { fontSize: 12 }]}>
              {(username[0] ?? 'U').toUpperCase()}
            </Text>
          </View>
        </View>
      )}

      {isTablet ? (
        <View style={styles.tabletContainer}>
          {/* ── HEADER (pleine largeur, au-dessus des 2 colonnes) ────── */}
          <Text style={styles.kicker}>{t('reservations.greetingPrefix')} {username.toUpperCase()}</Text>
          <Text style={styles.pageTitle}>
            {t('reservations.pageTitle1')} <GoldItalic>{t('reservations.pageTitleGold')}</GoldItalic>
          </Text>
          <TouchableOpacity style={styles.newRdvBtn} onPress={() => router.push('/(tabs)/book')} activeOpacity={0.85}>
            <Text style={styles.newRdvBtnText}>{t('reservations.newRdvBtn')}</Text>
          </TouchableOpacity>

          {mainTabsRow}

          {mainTab === 'coupes' && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              {mesCoupesGallery}
            </ScrollView>
          )}

          {mainTab === 'apercu' && (
          <View style={styles.tabletRow}>
            {/* ═══ COLONNE GAUCHE (40%) ═══════════════════════════════ */}
            <ScrollView
              style={styles.tabletLeftCol}
              contentContainerStyle={styles.tabletColContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Stats */}
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statNum}>12</Text>
                  <Text style={styles.statLabel}>{t('reservations.stats.visits')}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNum}>28</Text>
                  <Text style={styles.statNumSub}>{t('reservations.stats.days')}</Text>
                  <Text style={styles.statLabel}>{t('reservations.stats.lastVisit')}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statNum, { color: '#C9A84C' }]}>{MOCK_LOYALTY.points}</Text>
                  <Text style={styles.statNumSub}>/ 1000</Text>
                  <Text style={styles.statLabel}>{t('reservations.stats.loyaltyPoints')}</Text>
                </View>
              </View>

              {/* Prochain rendez-vous */}
              {showInitialLoader && (
                <ActivityIndicator color="#C9A84C" size="large" style={{ marginVertical: 30 }} />
              )}
              {!showInitialLoader && (error || nextRdvView) && (
                <>
                  <View style={styles.nextRdvBadgeWrap}>
                    <View style={styles.nextRdvBadge}>
                      <Text style={styles.nextRdvBadgeText}>{t('reservations.nextRdvBadge')}</Text>
                    </View>
                  </View>

                  <View style={styles.mockRdvCard}>
                    <View style={styles.mockRdvInner}>
                      <View style={styles.mockDateBox}>
                        <Text style={styles.mockDateNum}>{rdv.jour}</Text>
                        <Text style={styles.mockDateMon}>{rdv.mois}</Text>
                        <Text style={styles.mockDateDay}>{rdv.jourAbbr}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mockRdvService}>
                          {rdv.service
                            ? <GoldItalic>{rdv.service}</GoldItalic>
                            : <>{t('reservations.mockRdv.servicePrefix')} <GoldItalic>{t('reservations.mockRdv.serviceGold')}</GoldItalic></>
                          }
                        </Text>
                        <View style={styles.mockRdvInfoRow}>
                          <Text style={styles.mockRdvKey}>{t('reservations.mockRdv.time')}</Text>
                          <Text style={styles.mockRdvVal}>{rdv.time}</Text>
                        </View>
                        <View style={styles.mockRdvInfoRow}>
                          <Text style={styles.mockRdvKey}>{t('reservations.mockRdv.barber')}</Text>
                          <Text style={styles.mockRdvVal}>{rdv.barbier}</Text>
                        </View>
                        <View style={styles.mockRdvInfoRow}>
                          <Text style={styles.mockRdvKey}>{t('reservations.mockRdv.address')}</Text>
                          <Text style={styles.mockRdvVal}>Rue Auguste Van Zande 78</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.soldePill}>
                      <Text style={styles.soldeText}>{t('reservations.mockRdv.soldePrefix')} {t('reservations.mockRdv.soldeSuffix')}</Text>
                    </View>

                    <TouchableOpacity testID="btn-add-calendar" style={styles.btnPrimary} onPress={handleAddToCalendar} activeOpacity={0.85}>
                      <Text style={styles.btnPrimaryText}>{t('reservations.addToCalendar')}</Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <TouchableOpacity testID="btn-reprogrammer" style={[styles.btnOutline, { flex: 1 }]} onPress={handleReprogrammer} activeOpacity={0.85}>
                        <Text style={styles.btnOutlineText}>{t('reservations.reschedule')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity testID="btn-cancel-next-rdv" style={styles.btnDangerSm} onPress={() => nextReservation ? setCancelTarget(nextReservation) : handleCancelNextRdv()} activeOpacity={0.85}>
                        <Text style={styles.btnDangerSmText}>{t('reservations.cancelBtn')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              {/* Resume card */}
              <Text style={styles.sectionTitle}>{t('reservations.resumeTitle')}</Text>

              <View style={styles.resumeCard}>
                <View style={styles.resumeBadge}>
                  <Text style={styles.resumeBadgeText}>{t('reservations.resumeBadge')}</Text>
                </View>
                <View style={styles.resumeRow}>
                  <View style={styles.scissorsBox}>
                    <Text style={{ fontSize: 22 }}>✂️</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resumeServiceName}>{t('reservations.hist.signature')}</Text>
                    <Text style={styles.resumeServiceMeta}>{t('reservations.resumeServiceMeta')}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.btnPrimary, { flex: 1 }]}
                    onPress={() => router.push({
                      pathname: '/(tabs)/book',
                      params: {
                        quickbook: 'true',
                        prestation: 'Signature WilloBarber',
                        prix: '45',
                        duree: '45',
                        barbier: 'Willo',
                        date: 'Demain',
                        heure: '11:00',
                      },
                    })}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.btnPrimaryText}>{t('reservations.resumeCta')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnOutline, { paddingHorizontal: 18 }]} onPress={handleAdapter} activeOpacity={0.85}>
                    <Text style={styles.btnOutlineText}>{t('reservations.adaptBtn')}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Vos favoris */}
              <Text style={styles.sectionTitle}>{t('reservations.favoritesTitle')}</Text>

              <View style={styles.favGrid}>
                {FAVORIS.map((fav, i) => (
                  <View key={i} style={[styles.favCard, styles.favCardTablet]}>
                    <Text style={styles.favStar}>★</Text>
                    <Text style={styles.favName}>{fav.nom}</Text>
                    <Text style={styles.favMeta}>
                      {fav.dur} · <Text style={{ color: '#C9A84C' }}>{fav.prix}</Text>
                    </Text>
                    <View style={styles.favDivider} />
                    <Text style={styles.favCount}>{fav.count} · dernière {fav.date}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* ═══ COLONNE DROITE (60%) ═══════════════════════════════ */}
            <ScrollView
              style={styles.tabletRightCol}
              contentContainerStyle={styles.tabletColContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#C9A84C" />}
            >
              {/* Historique des réservations */}
              <Text style={[styles.sectionTitle, { marginTop: 0 }]}>{t('reservations.historyTitle')}</Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginBottom: 14 }}
              >
                {['Tous', '2026', '2025'].map(yr => (
                  <Pressable
                    key={yr}
                    onPress={() => { setHistFilter(yr); setSelectedHistIndex(0); }}
                    style={[styles.filterChip, histFilter === yr && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, histFilter === yr && styles.filterChipTextActive]}>{yr === 'Tous' ? t('reservations.filter.all') : yr}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {showInitialLoader ? (
                <ActivityIndicator color="#C9A84C" size="large" style={{ marginVertical: 30 }} />
              ) : filteredHist.length === 0 ? (
                <Text style={styles.emptyHist}>{t('reservations.emptyHistory')}</Text>
              ) : (
                <View style={styles.histSplit}>
                  <View style={styles.histSplitList}>
                    {filteredHist.map((h, i) => {
                      const isSelected = i === Math.min(selectedHistIndex, filteredHist.length - 1);
                      return (
                        <Pressable
                          key={i}
                          onPress={() => setSelectedHistIndex(i)}
                          style={[styles.histListRow, isSelected && styles.histListRowActive]}
                        >
                          <View style={styles.histDateBox}>
                            <Text style={styles.histDateNum}>{h.jour}</Text>
                            <Text style={styles.histDateMon}>{h.mois}</Text>
                          </View>
                          <View style={{ flex: 1, gap: 3 }}>
                            <Text style={styles.histService} numberOfLines={1}>{h.service}</Text>
                            <Text style={styles.histMeta}>{h.barbierNom} · {h.prix}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                  {(() => {
                    const h = filteredHist[Math.min(selectedHistIndex, filteredHist.length - 1)];
                    const i = Math.min(selectedHistIndex, filteredHist.length - 1);
                    return (
                      <View style={styles.histSplitDetail}>
                        <View style={styles.histDetailHeader}>
                          <View style={[styles.histDateBox, { backgroundColor: '#2A2520' }]}>
                            <Text style={styles.histDateNum}>{h.jour}</Text>
                            <Text style={styles.histDateMon}>{h.mois}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.histDetailService}>{h.service}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                              <View style={[
                                styles.avatar,
                                { width: 30, height: 30, borderRadius: 15, backgroundColor: h.couleur + '33', borderColor: h.couleur },
                              ]}>
                                <Text style={[styles.avatarText, { fontSize: 12, color: h.couleur }]}>{h.barbier}</Text>
                              </View>
                              <Text style={styles.histMeta}>{h.barbierNom}</Text>
                              <Text style={{ color: '#C9A84C', fontSize: 14, fontWeight: '700' }}>{h.prix}</Text>
                            </View>
                          </View>
                        </View>
                        <Text style={styles.histDetailRef}>N° WB-{h.annee}-{String(i + 1).padStart(5, '0')}</Text>
                        <View style={{ flexDirection: 'column', gap: 10, marginTop: 18 }}>
                          <TouchableOpacity testID={`btn-rebook-${i}`} style={[styles.btnPrimary, { width: '100%' }]} onPress={() => handleRebook(h)} activeOpacity={0.85}>
                            <Text style={styles.btnPrimaryText}>{t('reservations.rebook')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity testID={`btn-receipt-${i}`} style={[styles.btnOutline, { width: '100%' }]} onPress={() => handleReceipt(h, i)} activeOpacity={0.85}>
                            <Text style={styles.btnOutlineText}>{t('reservations.receipt')}</Text>
                          </TouchableOpacity>
                        </View>
                        {h.status === 'completed' && h.id != null && (
                          <View style={{ marginTop: 18 }}>
                            <ReviewCard
                              reservationId={h.id}
                              serviceName={h.service}
                              existingReview={reviewForReservation(h.id)}
                              onSubmitted={handleReviewSubmitted}
                            />
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
              )}

              {/* Programme fidélité */}
              <Text style={[styles.sectionKicker, { marginTop: 28 }]}>{t('reservations.loyalty.programTitle')}</Text>
              <View style={styles.loyaltyCard}>
                <View style={styles.loyaltyHeader}>
                  <View>
                    <Text style={styles.loyaltyBrandLogo}>{'{w}'} willobarber</Text>
                    <Text style={styles.loyaltyBrandSub}>{t('reservations.loyalty.brandSub')}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.loyaltyPoints}>{MOCK_LOYALTY.points}</Text>
                    <Text style={styles.loyaltyPtsSuffix}>pts</Text>
                  </View>
                </View>

                <Text style={styles.loyaltyProgressLabel}>{t('reservations.loyalty.progressLabel')}</Text>
                <View style={styles.loyaltyBarBg}>
                  <Animated.View
                    style={[
                      styles.loyaltyBarFill,
                      {
                        width: barAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.loyaltyBarCaption}>
                  {ptsRestants} pts avant votre prochaine coupe offerte
                </Text>

                <View style={styles.loyaltyTiersRow}>
                  {TIERS.map((tier, i) => {
                    const reached  = MOCK_LOYALTY.points >= tier.min;
                    const nextTier = TIERS[i + 1];
                    const isActive  = reached && (!nextTier || MOCK_LOYALTY.points < nextTier.min);
                    const isDepasse = reached && !isActive;
                    return (
                      <View key={tier.label} style={styles.tierBadgeWrap}>
                        <View
                          style={[
                            styles.tierBadge,
                            isActive  && { backgroundColor: tier.color },
                            isDepasse && { backgroundColor: '#2A2520', borderWidth: 1, borderColor: tier.color },
                            !reached  && { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.tierBadgeText,
                              isActive  && { color: '#1A1208' },
                              isDepasse && { color: tier.color },
                              !reached  && { color: 'rgba(255,255,255,0.35)' },
                            ]}
                          >
                            {tier.label}
                          </Text>
                        </View>
                        <Text style={styles.tierThreshold}>{tier.threshold}</Text>
                      </View>
                    );
                  })}
                </View>

                {MOCK_LOYALTY.points >= 500 ? (
                  <>
                    <TouchableOpacity style={styles.loyaltyCta} activeOpacity={0.85}>
                      <Text style={styles.loyaltyCtaText}>{t('reservations.loyalty.ctaText')}</Text>
                    </TouchableOpacity>
                    <Text style={styles.loyaltyCtaNote}>{t('reservations.loyalty.ctaNote')}</Text>
                  </>
                ) : (
                  <Text style={styles.loyaltyCtaDisabled}>
                    500 {t('reservations.loyalty.pointsRequired')} ({500 - MOCK_LOYALTY.points} {t('reservations.loyalty.ctaDisabledSuffix')}
                  </Text>
                )}
              </View>

              {/* Historique des points */}
              <Text style={[styles.sectionKicker, { marginTop: 24 }]}>{t('reservations.pointsHistoryTitle')}</Text>
              {TRANSACTIONS.map(tx => {
                const isSpend = tx.type === 'spend';
                const isBonus = tx.type === 'bonus';
                const iconColor = isSpend ? '#E53935' : isBonus ? '#64B5F6' : '#C9A84C';
                const ptColor   = isSpend ? '#E53935' : isBonus ? '#64B5F6' : '#4CAF50';
                const ptPrefix  = isSpend ? '' : '+';
                const iconChar  = isSpend ? '−' : isBonus ? '+' : '★';
                return (
                  <View key={tx.id} style={styles.txRow}>
                    <View style={[styles.txIconCircle, { backgroundColor: iconColor + '22', borderColor: iconColor + '55' }]}>
                      <Text style={{ color: iconColor, fontSize: 14 }}>{iconChar}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txReason}>{tx.reason}</Text>
                      <Text style={styles.txDate}>{tx.date}</Text>
                    </View>
                    <Text style={[styles.txPoints, { color: ptColor }]}>
                      {ptPrefix}{Math.abs(tx.points)} pts
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
          )}
        </View>
      ) : (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#C9A84C" />}
      >

        {/* ── 1. HEADER ─────────────────────────────────────────────── */}
        <Text style={styles.kicker}>{t('reservations.greetingPrefix')} {username.toUpperCase()}</Text>
        <Text style={styles.pageTitle}>
          {t('reservations.pageTitle1')} <GoldItalic>{t('reservations.pageTitleGold')}</GoldItalic>
        </Text>
        <TouchableOpacity style={styles.newRdvBtn} onPress={() => router.push('/(tabs)/book')} activeOpacity={0.85}>
          <Text style={styles.newRdvBtnText}>{t('reservations.newRdvBtn')}</Text>
        </TouchableOpacity>

        {mainTabsRow}

        {mainTab === 'coupes' && mesCoupesGallery}

        {mainTab === 'apercu' && (
        <>
        {/* ── 2. GRILLE STATS ───────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>12</Text>
            <Text style={styles.statLabel}>{t('reservations.stats.visits')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>28</Text>
            <Text style={styles.statNumSub}>{t('reservations.stats.days')}</Text>
            <Text style={styles.statLabel}>{t('reservations.stats.lastVisit')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#C9A84C' }]}>{MOCK_LOYALTY.points}</Text>
            <Text style={styles.statNumSub}>/ 1000</Text>
            <Text style={styles.statLabel}>{t('reservations.stats.loyaltyPoints')}</Text>
          </View>
        </View>

        {/* ── 3. PROCHAIN RENDEZ-VOUS ───────────────────────────────── */}
        {showInitialLoader && (
          <ActivityIndicator color="#C9A84C" size="large" style={{ marginVertical: 30 }} />
        )}
        {!showInitialLoader && (error || nextRdvView) && (
          <>
            <View style={styles.nextRdvBadgeWrap}>
              <View style={styles.nextRdvBadge}>
                <Text style={styles.nextRdvBadgeText}>{t('reservations.nextRdvBadge')}</Text>
              </View>
            </View>

            <View style={styles.mockRdvCard}>
              <View style={styles.mockRdvInner}>
                <View style={styles.mockDateBox}>
                  <Text style={styles.mockDateNum}>{rdv.jour}</Text>
                  <Text style={styles.mockDateMon}>{rdv.mois}</Text>
                  <Text style={styles.mockDateDay}>{rdv.jourAbbr}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mockRdvService}>
                    {rdv.service
                      ? <GoldItalic>{rdv.service}</GoldItalic>
                      : <>{t('reservations.mockRdv.servicePrefix')} <GoldItalic>{t('reservations.mockRdv.serviceGold')}</GoldItalic></>
                    }
                  </Text>
                  <View style={styles.mockRdvInfoRow}>
                    <Text style={styles.mockRdvKey}>{t('reservations.mockRdv.time')}</Text>
                    <Text style={styles.mockRdvVal}>{rdv.time}</Text>
                  </View>
                  <View style={styles.mockRdvInfoRow}>
                    <Text style={styles.mockRdvKey}>{t('reservations.mockRdv.barber')}</Text>
                    <Text style={styles.mockRdvVal}>{rdv.barbier}</Text>
                  </View>
                  <View style={styles.mockRdvInfoRow}>
                    <Text style={styles.mockRdvKey}>{t('reservations.mockRdv.address')}</Text>
                    <Text style={styles.mockRdvVal}>Rue Auguste Van Zande 78</Text>
                  </View>
                </View>
              </View>

              <View style={styles.soldePill}>
                <Text style={styles.soldeText}>{t('reservations.mockRdv.soldePrefix')} {t('reservations.mockRdv.soldeSuffix')}</Text>
              </View>

              <TouchableOpacity testID="btn-add-calendar" style={styles.btnPrimary} onPress={handleAddToCalendar} activeOpacity={0.85}>
                <Text style={styles.btnPrimaryText}>{t('reservations.addToCalendar')}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity testID="btn-reprogrammer" style={[styles.btnOutline, { flex: 1 }]} onPress={handleReprogrammer} activeOpacity={0.85}>
                  <Text style={styles.btnOutlineText}>{t('reservations.reschedule')}</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="btn-cancel-next-rdv" style={styles.btnDangerSm} onPress={() => nextReservation ? setCancelTarget(nextReservation) : handleCancelNextRdv()} activeOpacity={0.85}>
                  <Text style={styles.btnDangerSmText}>{t('reservations.cancelBtn')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* ── 4. REPRENEZ LÀ OÙ VOUS EN ÉTIEZ ────────────────────── */}
        <Text style={styles.sectionTitle}>{t('reservations.resumeTitle')}</Text>

        <View style={styles.resumeCard}>
          <View style={styles.resumeBadge}>
            <Text style={styles.resumeBadgeText}>{t('reservations.resumeBadge')}</Text>
          </View>
          <View style={styles.resumeRow}>
            <View style={styles.scissorsBox}>
              <Text style={{ fontSize: 22 }}>✂️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resumeServiceName}>{t('reservations.hist.signature')}</Text>
              <Text style={styles.resumeServiceMeta}>{t('reservations.resumeServiceMeta')}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.btnPrimary, { flex: 1 }]}
              onPress={() => router.push({
                pathname: '/(tabs)/book',
                params: {
                  quickbook: 'true',
                  prestation: 'Signature WilloBarber',
                  prix: '45',
                  duree: '45',
                  barbier: 'Willo',
                  date: 'Demain',
                  heure: '11:00',
                },
              })}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>{t('reservations.resumeCta')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnOutline, { paddingHorizontal: 18 }]} onPress={handleAdapter} activeOpacity={0.85}>
              <Text style={styles.btnOutlineText}>{t('reservations.adaptBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 5. VOS FAVORIS ────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>{t('reservations.favoritesTitle')}</Text>

        {isTablet ? (
          <View style={styles.favGrid}>
            {FAVORIS.map((fav, i) => (
              <View key={i} style={[styles.favCard, styles.favCardTablet]}>
                <Text style={styles.favStar}>★</Text>
                <Text style={styles.favName}>{fav.nom}</Text>
                <Text style={styles.favMeta}>
                  {fav.dur} · <Text style={{ color: '#C9A84C' }}>{fav.prix}</Text>
                </Text>
                <View style={styles.favDivider} />
                <Text style={styles.favCount}>{fav.count} · dernière {fav.date}</Text>
              </View>
            ))}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingRight: 4, marginBottom: 24 }}
          >
            {FAVORIS.map((fav, i) => (
              <View key={i} style={styles.favCard}>
                <Text style={styles.favStar}>★</Text>
                <Text style={styles.favName}>{fav.nom}</Text>
                <Text style={styles.favMeta}>
                  {fav.dur} · <Text style={{ color: '#C9A84C' }}>{fav.prix}</Text>
                </Text>
                <View style={styles.favDivider} />
                <Text style={styles.favCount}>{fav.count} · dernière {fav.date}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ── 6. HISTORIQUE DES RÉSERVATIONS ────────────────────────── */}
        <Text style={styles.sectionTitle}>{t('reservations.historyTitle')}</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: 14 }}
        >
          {['Tous', '2026', '2025'].map(yr => (
            <Pressable
              key={yr}
              onPress={() => { setHistFilter(yr); setSelectedHistIndex(0); }}
              style={[styles.filterChip, histFilter === yr && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, histFilter === yr && styles.filterChipTextActive]}>{yr === 'Tous' ? t('reservations.filter.all') : yr}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {showInitialLoader ? (
          <ActivityIndicator color="#C9A84C" size="large" style={{ marginVertical: 30 }} />
        ) : filteredHist.length === 0 ? (
          <Text style={styles.emptyHist}>{t('reservations.emptyHistory')}</Text>
        ) : isTablet ? (
          <View style={styles.histSplit}>
            <View style={styles.histSplitList}>
              {filteredHist.map((h, i) => {
                const isSelected = i === Math.min(selectedHistIndex, filteredHist.length - 1);
                return (
                  <Pressable
                    key={i}
                    onPress={() => setSelectedHistIndex(i)}
                    style={[styles.histListRow, isSelected && styles.histListRowActive]}
                  >
                    <View style={styles.histDateBox}>
                      <Text style={styles.histDateNum}>{h.jour}</Text>
                      <Text style={styles.histDateMon}>{h.mois}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.histService} numberOfLines={1}>{h.service}</Text>
                      <Text style={styles.histMeta}>{h.barbierNom} · {h.prix}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {(() => {
              const h = filteredHist[Math.min(selectedHistIndex, filteredHist.length - 1)];
              const i = Math.min(selectedHistIndex, filteredHist.length - 1);
              return (
                <View style={styles.histSplitDetail}>
                  <View style={styles.histDetailHeader}>
                    <View style={[styles.histDateBox, { backgroundColor: '#2A2520' }]}>
                      <Text style={styles.histDateNum}>{h.jour}</Text>
                      <Text style={styles.histDateMon}>{h.mois}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.histDetailService}>{h.service}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                        <View style={[
                          styles.avatar,
                          { width: 30, height: 30, borderRadius: 15, backgroundColor: h.couleur + '33', borderColor: h.couleur },
                        ]}>
                          <Text style={[styles.avatarText, { fontSize: 12, color: h.couleur }]}>{h.barbier}</Text>
                        </View>
                        <Text style={styles.histMeta}>{h.barbierNom}</Text>
                        <Text style={{ color: '#C9A84C', fontSize: 14, fontWeight: '700' }}>{h.prix}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.histDetailRef}>N° WB-{h.annee}-{String(i + 1).padStart(5, '0')}</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                    <TouchableOpacity testID={`btn-rebook-${i}`} style={[styles.btnPrimary, { flex: 1 }]} onPress={() => handleRebook(h)} activeOpacity={0.85}>
                      <Text style={styles.btnPrimaryText}>{t('reservations.rebook')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID={`btn-receipt-${i}`} style={[styles.btnOutline, { flex: 1 }]} onPress={() => handleReceipt(h, i)} activeOpacity={0.85}>
                      <Text style={styles.btnOutlineText}>{t('reservations.receipt')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}
          </View>
        ) : filteredHist.map((h, i) => (
            <React.Fragment key={i}>
              <View style={styles.histCard}>
                <View style={styles.histDateBox}>
                  <Text style={styles.histDateNum}>{h.jour}</Text>
                  <Text style={styles.histDateMon}>{h.mois}</Text>
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={styles.histService}>{h.service}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <View style={[
                      styles.avatar,
                      { width: 28, height: 28, borderRadius: 14, backgroundColor: h.couleur + '33', borderColor: h.couleur },
                    ]}>
                      <Text style={[styles.avatarText, { fontSize: 11, color: h.couleur }]}>{h.barbier}</Text>
                    </View>
                    <Text style={styles.histMeta}>{h.barbierNom}</Text>
                    <Text style={{ color: '#C9A84C', fontSize: 13, fontWeight: '600' }}>{h.prix}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TouchableOpacity testID={`btn-rebook-${i}`} style={styles.iconBtn} onPress={() => handleRebook(h)}>
                    <Text style={{ color: '#C9A84C', fontSize: 15 }}>↺</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID={`btn-receipt-${i}`} style={styles.iconBtn} onPress={() => handleReceipt(h, i)}>
                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15 }}>↓</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {h.status === 'completed' && h.id != null && (
                <View style={{ marginBottom: 10 }}>
                  <ReviewCard
                    reservationId={h.id}
                    serviceName={h.service}
                    existingReview={reviewForReservation(h.id)}
                    onSubmitted={handleReviewSubmitted}
                  />
                </View>
              )}
            </React.Fragment>
          ))
        }

        {/* ── 7. PROGRAMME FIDÉLITÉ ─────────────────────────────────── */}
        <Text style={[styles.sectionKicker, { marginTop: 28 }]}>{t('reservations.loyalty.programTitle')}</Text>
        <View style={styles.loyaltyCard}>
          <View style={styles.loyaltyHeader}>
            <View>
              <Text style={styles.loyaltyBrandLogo}>{'{w}'} willobarber</Text>
              <Text style={styles.loyaltyBrandSub}>{t('reservations.loyalty.brandSub')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.loyaltyPoints}>{MOCK_LOYALTY.points}</Text>
              <Text style={styles.loyaltyPtsSuffix}>pts</Text>
            </View>
          </View>

          <Text style={styles.loyaltyProgressLabel}>{t('reservations.loyalty.progressLabel')}</Text>
          <View style={styles.loyaltyBarBg}>
            <Animated.View
              style={[
                styles.loyaltyBarFill,
                {
                  width: barAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.loyaltyBarCaption}>
            {ptsRestants} pts avant votre prochaine coupe offerte
          </Text>

          <View style={styles.loyaltyTiersRow}>
            {TIERS.map((tier, i) => {
              const reached  = MOCK_LOYALTY.points >= tier.min;
              const nextTier = TIERS[i + 1];
              const isActive  = reached && (!nextTier || MOCK_LOYALTY.points < nextTier.min);
              const isDepasse = reached && !isActive;
              return (
                <View key={tier.label} style={styles.tierBadgeWrap}>
                  <View
                    style={[
                      styles.tierBadge,
                      isActive  && { backgroundColor: tier.color },
                      isDepasse && { backgroundColor: '#2A2520', borderWidth: 1, borderColor: tier.color },
                      !reached  && { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tierBadgeText,
                        isActive  && { color: '#1A1208' },
                        isDepasse && { color: tier.color },
                        !reached  && { color: 'rgba(255,255,255,0.35)' },
                      ]}
                    >
                      {tier.label}
                    </Text>
                  </View>
                  <Text style={styles.tierThreshold}>{tier.threshold}</Text>
                </View>
              );
            })}
          </View>

          {MOCK_LOYALTY.points >= 500 ? (
            <>
              <TouchableOpacity style={styles.loyaltyCta} activeOpacity={0.85}>
                <Text style={styles.loyaltyCtaText}>{t('reservations.loyalty.ctaText')}</Text>
              </TouchableOpacity>
              <Text style={styles.loyaltyCtaNote}>{t('reservations.loyalty.ctaNote')}</Text>
            </>
          ) : (
            <Text style={styles.loyaltyCtaDisabled}>
              500 {t('reservations.loyalty.pointsRequired')} ({500 - MOCK_LOYALTY.points} {t('reservations.loyalty.ctaDisabledSuffix')}
            </Text>
          )}
        </View>

        {/* ── 8. HISTORIQUE DES POINTS ──────────────────────────────── */}
        <Text style={[styles.sectionKicker, { marginTop: 24 }]}>{t('reservations.pointsHistoryTitle')}</Text>
        {TRANSACTIONS.map(tx => {
          const isSpend = tx.type === 'spend';
          const isBonus = tx.type === 'bonus';
          const iconColor = isSpend ? '#E53935' : isBonus ? '#64B5F6' : '#C9A84C';
          const ptColor   = isSpend ? '#E53935' : isBonus ? '#64B5F6' : '#4CAF50';
          const ptPrefix  = isSpend ? '' : '+';
          const iconChar  = isSpend ? '−' : isBonus ? '+' : '★';
          return (
            <View key={tx.id} style={styles.txRow}>
              <View style={[styles.txIconCircle, { backgroundColor: iconColor + '22', borderColor: iconColor + '55' }]}>
                <Text style={{ color: iconColor, fontSize: 14 }}>{iconChar}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txReason}>{tx.reason}</Text>
                <Text style={styles.txDate}>{tx.date}</Text>
              </View>
              <Text style={[styles.txPoints, { color: ptColor }]}>
                {ptPrefix}{Math.abs(tx.points)} pts
              </Text>
            </View>
          );
        })}
        </>
        )}
      </ScrollView>
      )}

      <CancelModal
        visible={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={cancelling}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0C0A' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight ?? 0),
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerLogo:  { fontFamily: Fonts.bold, fontSize: 22, fontWeight: '700', color: '#C9A84C' },
  headerBrand: { fontFamily: Fonts.semiBold, fontSize: 19, fontWeight: '600', color: '#fff' },

  scroll:        { flex: 1 },
  scrollContent: { padding: 22, paddingBottom: 56 },

  mainTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
  },
  mainTabPill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 100,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  mainTabPillActive: {
    backgroundColor: '#C9A84C',
    borderColor: '#C9A84C',
  },
  mainTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  mainTabTextActive: {
    color: '#1A1208',
  },

  // ── iPad — layout 2 colonnes ────────────────────────────────────────────────
  tabletContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  tabletRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 20,
  },
  tabletLeftCol: {
    flex: 2,
  },
  tabletRightCol: {
    flex: 3,
  },
  tabletColContent: {
    paddingBottom: 56,
  },

  kicker:    { fontSize: 11, fontWeight: '600', letterSpacing: 2, color: '#C9A84C', textTransform: 'uppercase', marginBottom: 6 },
  pageTitle: { fontFamily: Fonts.bold, fontSize: 34, fontWeight: '700', color: '#fff', lineHeight: 40, marginBottom: 18 },

  sectionKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#C9A84C',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 14,
    marginTop: 24,
  },

  // Bouton principal
  newRdvBtn: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 5,
  },
  newRdvBtnText: { color: '#1A1208', fontWeight: '700', fontSize: 15 },

  // ── Stats grid ──────────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1814',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statNum: {
    fontFamily: Fonts.bold,
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 40,
  },
  statNumSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
    marginTop: 1,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 5,
    textAlign: 'center',
  },

  // ── Prochain RDV badge ──────────────────────────────────────────────────────
  nextRdvBadgeWrap: { marginBottom: 10 },
  nextRdvBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2D6A4F',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nextRdvBadgeText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.3, color: '#fff' },

  // ── Mock RDV card ──────────────────────────────────────────────────────────
  mockRdvCard: {
    backgroundColor: '#1A1814',
    borderRadius: 16,
    padding: 18,
    marginBottom: 8,
  },
  mockRdvInner: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  mockDateBox: {
    backgroundColor: '#2A2520',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    flexShrink: 0,
  },
  mockDateNum: { fontFamily: Fonts.bold, fontSize: 32, fontWeight: '700', color: '#C9A84C', lineHeight: 34 },
  mockDateMon: { fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.55)', marginTop: 3, textTransform: 'uppercase' },
  mockDateDay: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 },

  mockRdvService: { fontFamily: Fonts.semiBold, fontSize: 22, fontWeight: '600', color: '#fff', marginBottom: 8, lineHeight: 26 },
  mockRdvInfoRow: { flexDirection: 'row', gap: 8, marginTop: 3 },
  mockRdvKey:     { fontSize: 12, color: 'rgba(255,255,255,0.5)', width: 52 },
  mockRdvVal:     { fontSize: 12, color: 'rgba(255,255,255,0.85)', flex: 1 },

  soldePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  soldeText: { fontSize: 12, color: '#C9A84C', fontWeight: '500' },

  // ── Resume card ──────────────────────────────────────────────────────────────
  resumeCard: {
    backgroundColor: '#1A1814',
    borderRadius: 16,
    padding: 18,
    marginBottom: 8,
  },
  resumeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  resumeBadgeText: { fontSize: 10.5, fontWeight: '700', color: '#C9A84C', letterSpacing: 0.5 },
  resumeRow:       { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 16 },
  scissorsBox: {
    width: 48,
    height: 48,
    backgroundColor: '#2A2520',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resumeServiceName: { fontFamily: Fonts.bold, fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  resumeServiceMeta: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },

  // ── Favoris ──────────────────────────────────────────────────────────────────
  favCard: {
    backgroundColor: '#1A1814',
    borderRadius: 14,
    padding: 16,
    width: 200,
  },
  favStar:    { fontSize: 18, color: '#C9A84C', marginBottom: 8 },
  favName:    { fontFamily: Fonts.bold, fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 6 },
  favMeta:    { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 10 },
  favDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 8 },
  favCount:   { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  favGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  favCardTablet: { width: '48%' },

  // ── Historique — vue iPad master/detail ─────────────────────────────────────
  histSplit:       { flexDirection: 'row', gap: 16, marginBottom: 20 },
  histSplitList:   { width: '40%', gap: 8 },
  histSplitDetail: { flex: 1, backgroundColor: '#1A1814', borderRadius: 16, padding: 20 },
  histListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1814',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  histListRowActive: { borderColor: '#C9A84C' },
  histDetailHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  histDetailService: { fontFamily: Fonts.semiBold, fontSize: 22, fontWeight: '600', color: '#fff' },
  histDetailRef:     { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 16, fontFamily: 'monospace' },

  // ── Historique réservations ───────────────────────────────────────────────────
  filterChip:           { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100, backgroundColor: '#1A1814', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterChipActive:     { backgroundColor: '#C9A84C', borderColor: '#C9A84C' },
  filterChipText:       { fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  filterChipTextActive: { color: '#1A1208' },
  emptyHist:            { fontSize: 13.5, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 10, marginBottom: 20 },

  histCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1A1814',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  histDateBox: { width: 42, alignItems: 'center', flexShrink: 0 },
  histDateNum: { fontFamily: Fonts.bold, fontSize: 22, fontWeight: '700', color: '#fff', lineHeight: 25 },
  histDateMon: { fontSize: 11, letterSpacing: 0.5, color: 'rgba(255,255,255,0.5)', marginTop: 1, textTransform: 'uppercase' },
  histService: { fontSize: 15, fontWeight: '500', color: '#fff' },
  histMeta:    { fontSize: 11.5, color: 'rgba(255,255,255,0.5)' },

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Avatar
  avatar:     { backgroundColor: 'rgba(201,168,76,0.2)', borderWidth: 1.5, borderColor: '#C9A84C', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#C9A84C', fontFamily: Fonts.semiBold, fontWeight: '600' },

  // Buttons
  btnPrimary: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 4,
  },
  btnPrimaryText: { color: '#1A1208', fontWeight: '700', fontSize: 14.5 },
  btnOutline: {
    borderRadius: 100,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: { color: 'rgba(255,255,255,0.8)', fontWeight: '500', fontSize: 13.5 },
  btnDanger: {
    flex: 1,
    backgroundColor: '#FDECEA',
    borderRadius: 100,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnDangerText:   { color: '#C0392B', fontWeight: '600', fontSize: 14.5 },
  btnDangerSm:     { backgroundColor: '#FDECEA', borderRadius: 100, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  btnDangerSmText: { color: '#C0392B', fontWeight: '600', fontSize: 13.5 },

  // ── Loyalty card ──────────────────────────────────────────────────────────────
  loyaltyCard: {
    backgroundColor: '#1A1814',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  loyaltyHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  loyaltyBrandLogo: { fontFamily: Fonts.bold, fontSize: 16, fontWeight: '700', color: '#C9A84C' },
  loyaltyBrandSub:  { fontSize: 12, color: '#fff', marginTop: 2 },
  loyaltyPoints:    { fontFamily: Fonts.bold, fontSize: 32, fontWeight: '700', color: '#C9A84C', lineHeight: 34 },
  loyaltyPtsSuffix: { fontSize: 13, color: '#fff', textAlign: 'right', marginTop: 2 },

  loyaltyProgressLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  loyaltyBarBg:         { height: 8, borderRadius: 4, backgroundColor: '#2A2520', marginBottom: 8 },
  loyaltyBarFill:       { height: 8, borderRadius: 4, backgroundColor: '#C9A84C' },
  loyaltyBarCaption:    { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 16 },

  loyaltyTiersRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  tierBadgeWrap:   { flex: 1, alignItems: 'center', gap: 6 },
  tierBadge: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 100,
  },
  tierBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  tierThreshold: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },

  loyaltyCta: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 8,
  },
  loyaltyCtaText:     { fontFamily: Fonts.semiBold, color: '#1A1208', fontWeight: '600', fontSize: 14 },
  loyaltyCtaNote:     { fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  loyaltyCtaDisabled: { fontSize: 12.5, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },

  // ── Transaction history ────────────────────────────────────────────────────────
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1814',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  txIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txReason: { fontSize: 15, color: '#fff', marginBottom: 2 },
  txDate:   { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  txPoints: { fontFamily: Fonts.bold, fontSize: 18, fontWeight: '700' },

  // Cancel modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalOverlayTablet: { justifyContent: 'center', alignItems: 'center' },
  modalBox: {
    backgroundColor: '#1A1814',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalBoxTablet: {
    borderRadius: 24,
    width: '90%',
    maxWidth: 480,
    paddingBottom: 24,
  },
  modalTitle: { fontFamily: Fonts.semiBold, fontSize: 22, fontWeight: '600', color: '#fff', marginBottom: 8 },
  modalSub:   { fontSize: 13.5, color: 'rgba(255,255,255,0.5)', marginBottom: 18, lineHeight: 19 },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 8 },
  modalInput: {
    backgroundColor: '#252018',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 18,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
});
