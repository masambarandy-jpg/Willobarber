import React, { useEffect } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/hooks/useAuth';
import { TokenStorage } from '@/services/api';
import { API_BASE_URL, Fonts } from '@/constants';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TranslationKey } from '@/i18n/translations';
import {
  ACOMPTE_FIXE,
  dayBeforeLabel,
  fmtPrice,
  formatDateShortFr,
  formatSlot,
  getServiceDurationMinutes,
  type AmountChoice,
  type BookingState,
} from './data';

const GOLD        = '#C9A84C';
const CARD        = '#1A1814';
const GREY        = '#6B6560';
const GREEN_BG    = '#2D6A4F';
const GREEN_TEXT  = '#6fc191';
const BORDER_THIN = 'rgba(255,255,255,0.08)';
const ADDRESS     = 'Rue Auguste Van Zande 78';
const BOOKING_NUMBER = 'WB-2026-08471';

interface Props {
  booking: BookingState;
  reservationId: number | null;
  amountChoice: AmountChoice;
  onGoHome: () => void;
  onReschedule: () => void;
}

function DotLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dotRow}>
      <View style={styles.dot} />
      <Text style={styles.dotLabel}>{label}</Text>
      <Text style={styles.dotValue}>{value}</Text>
    </View>
  );
}

function RecapLine({
  label,
  value,
  negative,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <View style={styles.recapRow}>
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={[styles.recapValue, negative && { color: '#E57373' }]}>{value}</Text>
    </View>
  );
}

export function BookingConfirmation({ booking, reservationId, amountChoice, onGoHome, onReschedule }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { service, barber, date, time } = booking;
  const serviceName = service ? t(`services.svc.${service.id}.name` as TranslationKey) : null;

  useEffect(() => {
    console.log('[CONFIRMATION] reservationId reçu:', reservationId);
  }, [reservationId]);

  const isFullyPaid = amountChoice === 'full';
  const price   = service ? service.price : 0;
  const deposit = isFullyPaid ? price : ACOMPTE_FIXE;
  const solde   = isFullyPaid ? 0 : price - deposit;
  const paidLabel = isFullyPaid ? t('bookingConfirm.fullyPaid') : t('bookingConfirm.depositPaid');

  const smsDate    = date ? dayBeforeLabel(date) : '';
  const dateStr    = date ? formatDateShortFr(date) : '—';
  const timeStr    = time ? formatSlot(time) : '—';

  const topPadding = Platform.OS === 'ios' ? 58 : (StatusBar.currentHeight ?? 0) + 20;

  const handleAddToCalendar = () => {
    if (!date || !time) return;
    const durMin = service ? getServiceDurationMinutes(service.dur) : 30;
    const [h, m] = time.split(':').map(Number);
    const start = new Date(date);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + durMin * 60000);

    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) =>
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

    const text    = encodeURIComponent(`${serviceName ?? t('bookingConfirm.defaultServiceName')} — WilloBarber`);
    const details = encodeURIComponent(
      `Barbier : ${barber?.name ?? '—'}\nAdresse : ${ADDRESS}\nSolde à payer au salon : ${fmtPrice(solde)}`
    );
    const location = encodeURIComponent(ADDRESS);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${location}`;

    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN });
    }
  };

  const handleGoToReservations = () => {
    router.push('/(tabs)/reservations');
  };

  const handleGenerateInvoice = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert(t('bookingConfirm.invoiceWebOnlyTitle'), t('bookingConfirm.invoiceWebOnlyMsg'));
      return;
    }
    if (!reservationId) {
      Alert.alert('Facture indisponible', "Impossible d'identifier la réservation pour générer la facture.");
      return;
    }

    try {
      const token = await TokenStorage.getAccess();
      console.log('[FACTURE] Téléchargement pour reservationId:', reservationId, 'URL:', `/api/reservations/${reservationId}/acompte-invoice/`);
      const response = await fetch(`${API_BASE_URL}/reservations/${reservationId}/acompte-invoice/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`invoice-fetch-failed-${response.status}`);

      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Facture_WilloBarber_${reservationId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[FACTURE] Erreur téléchargement:', e);
      Alert.alert('Erreur', "Impossible de télécharger la facture pour le moment.");
    }
  };

  const handleCancelAppointment = () => {
    const label = `${serviceName ?? t('bookingConfirm.defaultBarberName')} du ${dateStr} à ${timeStr}`;
    if (Platform.OS === 'web') {
      const confirmedCancel = window.confirm(`${t('common.cancel')} ${label} ?`);
      if (confirmedCancel) {
        window.alert(`${t('reservations.cancelNextAlert.doneTitle')}. ${t('reservations.cancelNextAlert.doneMsg')}`);
        onGoHome();
      }
      return;
    }
    Alert.alert(
      t('reservations.cancelNextAlert.title'),
      `${label} ${t('reservations.cancelNextAlert.body')}`,
      [
        { text: t('reservations.cancelNextAlert.cancelBtn'), style: 'cancel' },
        {
          text: t('reservations.cancelNextAlert.confirmBtn'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(t('reservations.cancelNextAlert.doneTitle'), t('reservations.cancelNextAlert.doneMsg'));
            onGoHome();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Halo vert ─────────────────────────────────────────────────── */}
        <View style={styles.haloZone}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.kicker}>{t('bookingConfirm.kicker')}</Text>
          <Text style={styles.heroTitle}>
            {t('bookingConfirm.heroTitle1')}{' '}
            <Text style={styles.heroTitleGold}>{t('bookingConfirm.heroTitleGold')}</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            {t('bookingConfirm.heroSubtitle')}
          </Text>
        </View>

        {/* ── Numéro de réservation ─────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.bookingNumRow}>
            <View style={styles.bookingNumLeft}>
              <Text style={styles.bookingNumKicker}>{t('bookingConfirm.bookingNumKicker')}</Text>
              <Text style={styles.bookingNum}>{BOOKING_NUMBER}</Text>
            </View>
            <View style={styles.emailBadge}>
              <Text style={styles.emailBadgeText}>{t('bookingConfirm.emailSent')}</Text>
            </View>
          </View>
        </View>

        {/* ── Votre rendez-vous ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.calIcon}>📅</Text>
            <Text style={styles.cardTitle}>{t('bookingConfirm.appointmentTitle')}</Text>
          </View>

          {serviceName && (
            <View style={styles.serviceBadge}>
              <Text style={styles.serviceBadgeText}>{serviceName}</Text>
            </View>
          )}

          <View style={styles.dotList}>
            <DotLine label={t('book.recap.barber')}     value={barber?.name ?? '—'} />
            <DotLine label={t('bookingStepper.dateTime')} value={`${dateStr} · ${timeStr}`} />
            <DotLine label={t('bookingConfirm.address')} value={ADDRESS} />
          </View>
        </View>

        {/* ── Récapitulatif de paiement ─────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.calIcon}>🧾</Text>
            <Text style={styles.cardTitle}>{t('bookingConfirm.paymentRecapTitle')}</Text>
          </View>

          <RecapLine label={serviceName ?? '—'} value={fmtPrice(price)} />
          <RecapLine label={paidLabel} value={`-${fmtPrice(deposit)}`} negative />

          <View style={styles.recapSep} />

          <View style={styles.soldeRow}>
            <Text style={styles.soldeLabel}>{t('step4.soldeLabel')}</Text>
            <Text style={styles.soldeValue}>{fmtPrice(solde)}</Text>
          </View>

          <Text style={styles.paymentNote}>{t('bookingConfirm.paymentNote')}</Text>
        </View>

        {/* ── Et maintenant ? ───────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('bookingConfirm.nextTitle')}</Text>

          <View style={styles.nextRow}>
            <Text style={styles.nextIcon}>📧</Text>
            <Text style={styles.nextLabel}>{t('bookingConfirm.confirmEmailLabel')}</Text>
            <View style={styles.nextBadgeGreen}>
              <Text style={styles.nextBadgeGreenText}>{t('bookingConfirm.sentBadge')}</Text>
            </View>
          </View>

          <View style={styles.nextRow}>
            <Text style={styles.nextIcon}>📱</Text>
            <Text style={styles.nextLabel}>{t('bookingConfirm.smsReminderLabel')}</Text>
            <View style={styles.nextBadgeGold}>
              <Text style={styles.nextBadgeGoldText}>{smsDate}</Text>
            </View>
          </View>

          <View style={[styles.nextRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.nextIcon}>✕</Text>
            <Text style={styles.nextLabel}>{t('bookingConfirm.freeCancelLabel')}</Text>
            <View style={styles.nextBadge}>
              <Text style={styles.nextBadgeText}>{t('bookingConfirm.freeCancelBadge')}</Text>
            </View>
          </View>
        </View>

        {/* ── Points gagnés ─────────────────────────────────────────────── */}
        {service && (() => {
          const earned      = service.price * 10;
          const mockCurrent = 980;
          const newTotal    = mockCurrent + earned;
          const nextReward  = 1000;
          const remaining   = Math.max(nextReward - newTotal, 0);
          return (
            <View style={styles.pointsCard}>
              <View style={styles.pointsCardHeader}>
                <Text style={styles.pointsStarIcon}>★</Text>
                <Text style={styles.pointsCardTitle}>{t('bookingConfirm.pointsEarnedTitle')}</Text>
              </View>
              <Text style={styles.pointsEarned}>+{earned} pts</Text>
              <Text style={styles.pointsSubtext}>{t('bookingConfirm.pointsCredited')}</Text>
              <View style={styles.pointsSep} />
              <Text style={styles.pointsFooter}>
                {t('bookingConfirm.pointsTotalPrefix')} {newTotal} pts
                {remaining > 0
                  ? ` · ${remaining} ${t('bookingConfirm.pointsRemainingSuffix')}`
                  : ` · ${t('bookingConfirm.pointsRewardAvailable')}`}
              </Text>
            </View>
          );
        })()}

        {/* ── Boutons ───────────────────────────────────────────────────── */}
        <View style={styles.btns}>
          <TouchableOpacity style={styles.btnCalendar} onPress={handleAddToCalendar} activeOpacity={0.85}>
            <Text style={styles.btnCalendarText}>{t('bookingConfirm.btnCalendar')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnDark}
            onPress={handleGoToReservations}
            activeOpacity={0.85}
          >
            <Text style={styles.btnDarkText}>{t('bookingConfirm.btnMySpace')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnDark}
            onPress={handleGenerateInvoice}
            activeOpacity={0.85}
          >
            <Text style={styles.btnDarkText}>{t('bookingConfirm.btnInvoice')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnDark}
            onPress={onReschedule}
            activeOpacity={0.85}
          >
            <Text style={styles.btnDarkText}>Faire une nouvelle réservation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCancelAppointment}
            activeOpacity={0.7}
            style={styles.btnCancel}
          >
            <Text style={styles.btnCancelText}>{t('bookingConfirm.btnCancel')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0C0A',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },

  // Halo zone
  haloZone: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  checkCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: GREEN_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: GREEN_BG,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 40,
      },
      android: { elevation: 8 },
    }),
  },
  checkIcon: {
    fontSize: 38,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    color: GOLD,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 10,
  },
  heroTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 34,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 12,
  },
  heroTitleGold: {
    color: GOLD,
    fontStyle: 'italic',
    fontFamily: Fonts.semiBoldItalic,
  },
  heroSubtitle: {
    fontSize: 13.5,
    color: GREY,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },

  // Cards
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  calIcon: { fontSize: 16, color: GOLD },
  cardTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 19,
    color: '#FFFFFF',
  },

  // Booking number card
  bookingNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bookingNumLeft: { flex: 1 },
  bookingNumKicker: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  bookingNum: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  emailBadge: {
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(111,193,145,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(111,193,145,0.3)',
  },
  emailBadgeText: {
    fontSize: 12,
    color: GREEN_TEXT,
    fontWeight: '500',
  },

  // Service badge
  serviceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: GOLD,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 14,
  },
  serviceBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: '#1a1208',
  },

  // Dot rows
  dotList: {},
  dotRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: BORDER_THIN,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: GOLD,
    marginTop: 5,
    flexShrink: 0,
  },
  dotLabel: {
    fontSize: 13,
    color: GREY,
    width: 80,
    flexShrink: 0,
  },
  dotValue: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 18,
  },

  // Recap payment card
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 10,
    backgroundColor: '#242018',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_THIN,
  },
  recapLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  recapValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  recapSep: {
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.4)',
    marginVertical: 12,
  },
  soldeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soldeLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: GOLD,
    textTransform: 'uppercase',
    flex: 1,
  },
  soldeValue: {
    fontFamily: Fonts.bold,
    fontSize: 32,
    color: GOLD,
    fontWeight: '700',
  },
  paymentNote: {
    fontSize: 12,
    color: GREY,
    textAlign: 'center',
    marginTop: 14,
  },

  // "Et maintenant" rows
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_THIN,
    marginTop: 12,
  },
  nextIcon: { fontSize: 15, width: 20, textAlign: 'center' },
  nextLabel: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
  },
  nextBadge: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nextBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: GREY,
  },
  nextBadgeGreen: {
    backgroundColor: 'rgba(111,193,145,0.12)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nextBadgeGreenText: {
    fontSize: 11,
    fontWeight: '500',
    color: GREEN_TEXT,
  },
  nextBadgeGold: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
  },
  nextBadgeGoldText: {
    fontSize: 11,
    fontWeight: '500',
    color: GOLD,
  },

  // Points earned card
  pointsCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    alignItems: 'center',
  },
  pointsCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pointsStarIcon: { fontSize: 20, color: GOLD },
  pointsCardTitle: { fontFamily: Fonts.semiBold, fontSize: 17, color: '#FFFFFF' },
  pointsEarned: { fontFamily: Fonts.bold, fontSize: 36, color: GOLD, fontWeight: '700', lineHeight: 40 },
  pointsSubtext: { fontSize: 13, color: GREY, marginTop: 4 },
  pointsSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', width: '100%', marginVertical: 12 },
  pointsFooter: { fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },

  // Buttons
  btns: {
    gap: 12,
    paddingTop: 8,
  },
  btnCalendar: {
    backgroundColor: GOLD,
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 5 },
    }),
  },
  btnCalendarText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: '#1a1208',
  },
  btnDark: {
    backgroundColor: CARD,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  btnDarkText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  btnCancel: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  btnCancelText: {
    fontSize: 14,
    color: '#e53935',
    textAlign: 'center',
  },
});
