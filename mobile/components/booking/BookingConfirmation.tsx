import React from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Fonts } from '@/constants';
import {
  calcDeposit,
  dayBeforeLabel,
  fmtPrice,
  formatDateShortFr,
  formatSlot,
  type BookingState,
} from './data';

const GOLD        = '#C9A84C';
const CARD        = '#1A1814';
const GREY        = '#6B6560';
const GREEN_BG    = '#2D6A4F';
const GREEN_TEXT  = '#6fc191';
const BORDER_THIN = 'rgba(255,255,255,0.08)';
const ADDRESS     = 'Rue Auguste Van Zande 78';

interface Props {
  booking: BookingState;
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
  green,
  noBorder,
}: {
  label: string;
  value: string;
  green?: boolean;
  noBorder?: boolean;
}) {
  return (
    <View style={[styles.recapRow, noBorder && { borderBottomWidth: 0 }]}>
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={[styles.recapValue, green && { color: GREEN_TEXT }]}>{value}</Text>
    </View>
  );
}

export function BookingConfirmation({ booking, onGoHome, onReschedule }: Props) {
  const { service, barber, date, time } = booking;

  const price   = service ? service.price : 0;
  const deposit = calcDeposit(price);
  const solde   = price - deposit;

  const smsDate    = date ? dayBeforeLabel(date) : '';
  const dateStr    = date ? formatDateShortFr(date) : '—';
  const timeStr    = time ? formatSlot(time) : '—';

  const topPadding = Platform.OS === 'ios' ? 58 : (StatusBar.currentHeight ?? 0) + 20;

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
          <Text style={styles.kicker}>CONFIRMATION</Text>
          <Text style={styles.heroTitle}>
            Votre rendez-vous est{' '}
            <Text style={styles.heroTitleGold}>confirmé.</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            Un email de confirmation vient de vous être envoyé.
            Rappel SMS la veille.
          </Text>
        </View>

        {/* ── Numéro de réservation ─────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.bookingNumRow}>
            <View style={styles.bookingNumLeft}>
              <Text style={styles.bookingNumKicker}>NUMÉRO DE RÉSERVATION</Text>
              <Text style={styles.bookingNum}>WB-2026-08471</Text>
            </View>
            <View style={styles.emailBadge}>
              <Text style={styles.emailBadgeText}>✓ Email envoyé</Text>
            </View>
          </View>
        </View>

        {/* ── Votre rendez-vous ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.calIcon}>📅</Text>
            <Text style={styles.cardTitle}>Votre rendez-vous</Text>
          </View>

          {service && (
            <View style={styles.serviceBadge}>
              <Text style={styles.serviceBadgeText}>{service.name}</Text>
            </View>
          )}

          <View style={styles.dotList}>
            <DotLine label="Barbier"      value={barber?.name ?? '—'} />
            <DotLine label="Date & heure" value={`${dateStr} · ${timeStr}`} />
            <DotLine label="Adresse"      value={ADDRESS} />
          </View>
        </View>

        {/* ── Récapitulatif de paiement ─────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Récapitulatif de paiement</Text>

          <RecapLine label={service?.name ?? '—'} value={fmtPrice(price)} />
          <RecapLine label="Acompte réglé"      value={`-${fmtPrice(deposit)}`}          green noBorder />

          <View style={styles.recapSep} />

          <View style={styles.soldeRow}>
            <Text style={styles.soldeLabel}>SOLDE À RÉGLER AU SALON</Text>
            <Text style={styles.soldeValue}>{fmtPrice(solde)}</Text>
          </View>
        </View>

        {/* ── Et maintenant ? ───────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Et maintenant ?</Text>

          <View style={styles.nextRow}>
            <Text style={styles.nextIcon}>📧</Text>
            <Text style={styles.nextLabel}>Email de confirmation</Text>
            <View style={styles.nextBadgeGreen}>
              <Text style={styles.nextBadgeGreenText}>Envoyé ✓</Text>
            </View>
          </View>

          <View style={styles.nextRow}>
            <Text style={styles.nextIcon}>📱</Text>
            <Text style={styles.nextLabel}>Rappel SMS</Text>
            <View style={styles.nextBadge}>
              <Text style={styles.nextBadgeText}>{smsDate}</Text>
            </View>
          </View>

          <View style={[styles.nextRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.nextIcon}>✕</Text>
            <Text style={styles.nextLabel}>Annulation gratuite</Text>
            <View style={styles.nextBadge}>
              <Text style={styles.nextBadgeText}>-24h</Text>
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
                <Text style={styles.pointsCardTitle}>Vous avez gagné</Text>
              </View>
              <Text style={styles.pointsEarned}>+{earned} pts</Text>
              <Text style={styles.pointsSubtext}>Crédités sur votre compte fidélité</Text>
              <View style={styles.pointsSep} />
              <Text style={styles.pointsFooter}>
                Total : {newTotal} pts
                {remaining > 0
                  ? ` · ${remaining} avant coupe offerte`
                  : ' · Coupe offerte disponible 🎉'}
              </Text>
            </View>
          );
        })()}

        {/* ── Boutons ───────────────────────────────────────────────────── */}
        <View style={styles.btns}>
          <TouchableOpacity style={styles.btnCalendar} activeOpacity={0.85}>
            <Text style={styles.btnCalendarText}>📅  Ajouter au calendrier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnReschedule}
            onPress={onReschedule}
            activeOpacity={0.85}
          >
            <Text style={styles.btnRescheduleText}>Reprogrammer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onGoHome}
            activeOpacity={0.7}
            style={styles.btnCancel}
          >
            <Text style={styles.btnCancelText}>Annuler le rendez-vous</Text>
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
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_THIN,
    marginTop: 12,
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
    backgroundColor: 'rgba(255,255,255,0.16)',
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
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    flex: 1,
  },
  soldeValue: {
    fontFamily: Fonts.bold,
    fontSize: 26,
    color: GOLD,
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
  btnReschedule: {
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  btnRescheduleText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
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
