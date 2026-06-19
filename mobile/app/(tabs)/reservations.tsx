import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
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
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useReservations } from '@/hooks/useReservations';
import type { Reservation } from '@/types';
import { Fonts } from '@/constants';

const MOCK_LOYALTY = {
  points: 980,
  total_earned: 1480,
};

const TRANSACTIONS = [
  { id: 1, date: '17 juin 2026', reason: 'Coupe Signature',         points:  450, type: 'earn'  },
  { id: 2, date: '03 juin 2026', reason: 'Le Rituel',               points:  750, type: 'earn'  },
  { id: 3, date: '20 mai 2026',  reason: 'Coupe gratuite utilisée', points: -500, type: 'spend' },
  { id: 4, date: '05 mai 2026',  reason: 'Rasage Traditionnel',     points:  280, type: 'earn'  },
  { id: 5, date: 'Bonus',        reason: 'Première réservation',    points:   50, type: 'bonus' },
];

const TIERS = [
  { label: 'BRONZE', min: 0,   threshold: '0 pts',   color: '#8B6914' },
  { label: 'ARGENT', min: 200, threshold: '200 pts',  color: '#6B6560' },
  { label: 'OR',     min: 500, threshold: '500 pts',  color: '#C9A84C' },
];

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

const STATUS_LABEL: Record<string, string> = {
  pending:          'En attente',
  confirmed:        'Confirmé',
  completed:        'Terminé',
  cancelled_client: 'Annulé',
  cancelled_barber: 'Annulé',
  no_show:          'Absent',
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending:          { bg: '#f6ecd0', text: '#8B6914' },
  confirmed:        { bg: '#D4EDDA', text: '#2D6A4F' },
  completed:        { bg: '#D4EDDA', text: '#2D6A4F' },
  cancelled_client: { bg: '#FDECEA', text: '#C0392B' },
  cancelled_barber: { bg: '#FDECEA', text: '#C0392B' },
  no_show:          { bg: '#FDECEA', text: '#C0392B' },
};

function GoldItalic({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: '#C9A84C', fontStyle: 'italic', fontFamily: Fonts.italic, fontWeight: '500' }}>
      {children}
    </Text>
  );
}

function Avatar({ initial, size = 44 }: { initial: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initial}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? { bg: '#f0f0f0', text: '#666' };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{STATUS_LABEL[status] ?? status}</Text>
    </View>
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
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Annuler ce rendez-vous</Text>
          <Text style={styles.modalSub}>Annulation gratuite 24h avant. Au-delà, l'acompte peut être conservé.</Text>
          <Text style={styles.fieldLabel}>Raison (optionnel)</Text>
          <TextInput
            style={styles.modalInput}
            value={reason}
            onChangeText={setReason}
            placeholder="Motif d'annulation…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
          />
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.btnOutline} onPress={onClose}>
              <Text style={styles.btnOutlineText}>Garder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnDanger} onPress={() => onConfirm(reason)} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#C0392B" size="small" />
                : <Text style={styles.btnDangerText}>Annuler le RDV</Text>
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
  const { user, isAuthenticated } = useAuth();
  const { upcoming, past, isLoading, refetch, cancel } = useReservations();
  const [histFilter, setHistFilter] = useState('Tous');
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: getBarProgress(MOCK_LOYALTY.points),
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, []);

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  const firstName = user?.first_name || user?.username || '';

  const filteredPast = histFilter === 'Tous'
    ? past
    : past.filter(r => r.date?.startsWith(histFilter));

  const handleCancel = async (reason: string) => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancel(cancelTarget.id, reason);
      setCancelTarget(null);
    } catch {
      Alert.alert('Erreur', "Impossible d'annuler cette réservation.");
    } finally {
      setCancelling(false);
    }
  };

  const nextTarget  = getNextTarget(MOCK_LOYALTY.points);
  const ptsRestants = nextTarget - MOCK_LOYALTY.points;

  return (
    <View style={styles.root}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLogo}>{'{w}'}</Text>
          <Text style={styles.headerBrand}>willobarber</Text>
        </View>
        <View style={styles.headerRight}>
          <Avatar initial={(firstName[0] ?? 'U').toUpperCase()} size={32} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#C9A84C" />}
      >
        {/* Greeting */}
        <Text style={styles.kicker}>— BONJOUR {firstName.toUpperCase()}</Text>
        <Text style={styles.pageTitle}>
          Votre espace, <GoldItalic>au poil.</GoldItalic>
        </Text>

        {/* Bouton nouveau RDV */}
        {Platform.OS === 'android' ? (
          <View style={[styles.newRdvBtn, { overflow: 'hidden', paddingVertical: 0 }]}>
            <TouchableNativeFeedback
              onPress={() => router.push('/(tabs)/book')}
              background={TouchableNativeFeedback.Ripple('rgba(26,18,8,0.2)', false)}
            >
              <View style={{ paddingVertical: 15, alignItems: 'center' }}>
                <Text style={styles.newRdvBtnText}>Nouveau rendez-vous →</Text>
              </View>
            </TouchableNativeFeedback>
          </View>
        ) : (
          <TouchableOpacity style={styles.newRdvBtn} onPress={() => router.push('/(tabs)/book')} activeOpacity={0.85}>
            <Text style={styles.newRdvBtnText}>Nouveau rendez-vous →</Text>
          </TouchableOpacity>
        )}

        {/* ── 1. PROCHAINS RENDEZ-VOUS ────────────────────────────── */}
        <Text style={styles.sectionKicker}>PROCHAINS RENDEZ-VOUS</Text>

        {upcoming.length > 0 && (() => {
          const next = upcoming[0];
          const daysUntil = next.date ? Math.ceil((new Date(next.date).getTime() - Date.now()) / 86400000) : 0;
          const d = next.date ? new Date(next.date) : null;
          const dayNum     = d?.getDate() ?? '—';
          const monthStr   = d?.toLocaleDateString('fr-BE', { month: 'short' }).toUpperCase() ?? '';
          const weekdayStr = d?.toLocaleDateString('fr-BE', { weekday: 'short' }).toUpperCase() ?? '';
          return (
            <View style={styles.nextRdvCard}>
              <View style={styles.nextRdvAccent} />
              <View style={styles.nextRdvContent}>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: '#D4EDDA' }]}>
                    <Text style={[styles.badgeText, { color: '#2D6A4F' }]}>PROCHAIN RDV · DANS {daysUntil} JOURS</Text>
                  </View>
                </View>
                <View style={styles.nextRdvMain}>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateNum}>{dayNum}</Text>
                    <Text style={styles.dateMon}>{monthStr}</Text>
                    <Text style={styles.dateWeekday}>{weekdayStr}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextRdvService}>{next.service_name ?? 'Prestation'}</Text>
                    <View style={styles.nextRdvInfo}>
                      <Text style={styles.nextRdvInfoKey}>Heure</Text>
                      <Text style={styles.nextRdvInfoVal}>{next.start_time ?? '—'}</Text>
                    </View>
                    <View style={styles.nextRdvInfo}>
                      <Text style={styles.nextRdvInfoKey}>Barbier</Text>
                      <Text style={styles.nextRdvInfoVal}>{next.barber_name ?? '—'}</Text>
                    </View>
                    <View style={styles.nextRdvInfo}>
                      <Text style={styles.nextRdvInfoKey}>Adresse</Text>
                      <Text style={styles.nextRdvInfoVal}>Rue Auguste Van Zande 78</Text>
                    </View>
                  </View>
                </View>
                {!!next.deposit_amount && (
                  <View style={styles.soldeRow}>
                    <Text style={styles.soldeText}>
                      Solde {(parseFloat(next.total_amount || '0') - parseFloat(next.deposit_amount || '0')).toFixed(2)}€ au salon
                    </Text>
                  </View>
                )}
                <View style={styles.nextRdvBtns}>
                  <TouchableOpacity style={styles.btnDangerSm} onPress={() => setCancelTarget(next)}>
                    <Text style={styles.btnDangerSmText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })()}

        {upcoming.length === 0 && !isLoading && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucun rendez-vous à venir</Text>
            <Text style={styles.emptySub}>Prenez rendez-vous en quelques clics.</Text>
            {Platform.OS === 'android' ? (
              <View style={[styles.btnPrimary, { marginTop: 16, alignSelf: 'stretch', overflow: 'hidden', paddingVertical: 0 }]}>
                <TouchableNativeFeedback
                  onPress={() => router.push('/(tabs)/book')}
                  background={TouchableNativeFeedback.Ripple('rgba(26,18,8,0.2)', false)}
                >
                  <View style={{ paddingVertical: 15, alignItems: 'center' }}>
                    <Text style={styles.btnPrimaryText}>Réserver maintenant →</Text>
                  </View>
                </TouchableNativeFeedback>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.btnPrimary, { marginTop: 16, alignSelf: 'stretch' }]}
                onPress={() => router.push('/(tabs)/book')}
                activeOpacity={0.85}
              >
                <Text style={styles.btnPrimaryText}>Réserver maintenant →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── 2. PROGRAMME FIDÉLITÉ ───────────────────────────────── */}
        <Text style={[styles.sectionKicker, { marginTop: 24 }]}>PROGRAMME FIDÉLITÉ</Text>
        <View style={styles.loyaltyCard}>
          {/* Header carte */}
          <View style={styles.loyaltyHeader}>
            <View>
              <Text style={styles.loyaltyBrandLogo}>{'{w}'} willobarber</Text>
              <Text style={styles.loyaltyBrandSub}>Programme Fidélité</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.loyaltyPoints}>{MOCK_LOYALTY.points}</Text>
              <Text style={styles.loyaltyPtsSuffix}>pts</Text>
            </View>
          </View>

          {/* Barre de progression */}
          <Text style={styles.loyaltyProgressLabel}>Progression vers la coupe gratuite</Text>
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

          {/* Paliers */}
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

          {/* CTA */}
          {MOCK_LOYALTY.points >= 500 ? (
            <>
              <TouchableOpacity style={styles.loyaltyCta} activeOpacity={0.85}>
                <Text style={styles.loyaltyCtaText}>Utiliser 500 pts — Coupe offerte →</Text>
              </TouchableOpacity>
              <Text style={styles.loyaltyCtaNote}>Valable sur toute coupe · Sans date d'expiration</Text>
            </>
          ) : (
            <Text style={styles.loyaltyCtaDisabled}>
              500 points requis ({500 - MOCK_LOYALTY.points} restants)
            </Text>
          )}
        </View>

        {/* ── 3. MES RÉSERVATIONS ─────────────────────────────────── */}
        <Text style={[styles.sectionKicker, { marginTop: 24 }]}>MES RÉSERVATIONS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: 14 }}
        >
          {['Tous', '2026', '2025'].map(t => (
            <Pressable
              key={t}
              onPress={() => setHistFilter(t)}
              style={[styles.filterChip, histFilter === t && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, histFilter === t && styles.filterChipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {filteredPast.length === 0 && !isLoading
          ? <Text style={styles.emptyHist}>Aucun historique à afficher.</Text>
          : filteredPast.map(r => (
            <View key={r.id} style={styles.histCard}>
              <View style={styles.histDateBox}>
                <Text style={styles.histDateNum}>{r.date ? new Date(r.date).getDate() : '—'}</Text>
                <Text style={styles.histDateMon}>
                  {r.date ? new Date(r.date).toLocaleDateString('fr-BE', { month: 'short' }).toUpperCase() : ''}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.histService}>{r.service_name ?? 'Prestation'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }}>
                  <Avatar initial={r.barber_name?.[0] ?? '?'} size={20} />
                  <Text style={styles.histMeta}>{r.barber_name ?? '—'} · {r.total_amount ?? '—'}€</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <StatusBadge status={r.status} />
                <TouchableOpacity onPress={() => router.push('/(tabs)/book')} style={styles.repeatBtn}>
                  <Text style={styles.repeatBtnText}>↻</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        }

        {isLoading && <ActivityIndicator color="#C9A84C" style={{ marginTop: 30 }} />}

        {/* ── 4. HISTORIQUE DES POINTS ────────────────────────────── */}
        <Text style={[styles.sectionKicker, { marginTop: 24 }]}>HISTORIQUE DES POINTS</Text>
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
  headerRight: {},

  scroll:        { flex: 1 },
  scrollContent: { padding: 22, paddingBottom: 48 },

  kicker:    { fontSize: 11, fontWeight: '600', letterSpacing: 2, color: '#C9A84C', textTransform: 'uppercase', marginBottom: 6 },
  pageTitle: { fontFamily: Fonts.semiBold, fontSize: 32, fontWeight: '600', color: '#fff', lineHeight: 38, marginBottom: 18 },

  // Section kicker (titres de sections)
  sectionKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#C9A84C',
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // Bouton nouveau RDV
  newRdvBtn: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 5,
  },
  newRdvBtnText: { color: '#1A1208', fontWeight: '700', fontSize: 15 },

  // Prochain RDV card
  nextRdvCard: {
    backgroundColor: '#1a160e',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.18)',
    borderRadius: 18,
    flexDirection: 'row',
    marginBottom: 14,
    overflow: 'hidden',
  },
  nextRdvAccent:  { width: 4, backgroundColor: '#C9A84C', flexShrink: 0 },
  nextRdvContent: { flex: 1, padding: 18 },
  badgeRow:       { marginBottom: 12 },
  badge:          { alignSelf: 'flex-start', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:      { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.3 },

  nextRdvMain:    { flexDirection: 'row', gap: 16, marginBottom: 12, alignItems: 'flex-start' },
  dateBox:        { borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)', borderRadius: 12, padding: 12, alignItems: 'center', flexShrink: 0 },
  dateNum:        { fontFamily: Fonts.bold, fontSize: 26, fontWeight: '700', color: '#C9A84C', lineHeight: 30 },
  dateMon:        { fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  dateWeekday:    { fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 1 },

  nextRdvService: { fontFamily: Fonts.semiBold, fontSize: 22, fontWeight: '600', color: '#fff', marginBottom: 6, lineHeight: 26 },
  nextRdvInfo:    { flexDirection: 'row', gap: 8, marginTop: 2 },
  nextRdvInfoKey: { fontSize: 12, color: 'rgba(255,255,255,0.5)', width: 50 },
  nextRdvInfoVal: { fontSize: 12, color: 'rgba(255,255,255,0.85)', flex: 1 },

  soldeRow: {
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  soldeText: { fontSize: 12, color: '#C9A84C', fontWeight: '500' },

  nextRdvBtns:    { flexDirection: 'row', gap: 10 },
  btnDangerSm:    { backgroundColor: '#FDECEA', borderRadius: 100, paddingHorizontal: 16, paddingVertical: 9 },
  btnDangerSmText:{ color: '#C0392B', fontWeight: '600', fontSize: 13 },

  // Empty state
  emptyCard: {
    backgroundColor: '#1A1814',
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 20, fontWeight: '600', color: '#fff', textAlign: 'center' },
  emptySub:   { fontSize: 13.5, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 6, lineHeight: 19 },

  // History list
  filterChip:         { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' },
  filterChipActive:   { backgroundColor: '#C9A84C' },
  filterChipText:     { fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  filterChipTextActive: { color: '#1A1208' },
  emptyHist:          { fontSize: 13.5, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 10 },

  histCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1A1814',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  histDateBox:  { width: 42, alignItems: 'center', flexShrink: 0 },
  histDateNum:  { fontFamily: Fonts.bold, fontSize: 21, fontWeight: '700', color: '#fff', lineHeight: 24 },
  histDateMon:  { fontSize: 9, letterSpacing: 0.5, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  histService:  { fontSize: 14, fontWeight: '500', color: '#fff' },
  histMeta:     { fontSize: 11.5, color: 'rgba(255,255,255,0.5)' },
  repeatBtn:    { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  repeatBtnText:{ color: '#C9A84C', fontSize: 16 },

  // Avatar
  avatar:     { backgroundColor: 'rgba(201,168,76,0.2)', borderWidth: 1.5, borderColor: '#C9A84C', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#C9A84C', fontFamily: Fonts.semiBold, fontWeight: '600' },

  // Buttons
  btnPrimary: {
    backgroundColor: '#C9A84C',
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 5,
  },
  btnPrimaryText: { color: '#1A1208', fontWeight: '700', fontSize: 15 },
  btnOutline: {
    flex: 1,
    borderRadius: 100,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
  },
  btnOutlineText: { color: 'rgba(255,255,255,0.8)', fontWeight: '500', fontSize: 14.5 },
  btnDanger: {
    flex: 1,
    backgroundColor: '#FDECEA',
    borderRadius: 100,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnDangerText: { color: '#C0392B', fontWeight: '600', fontSize: 14.5 },

  // ── Loyalty card ──────────────────────────────────────────────────────────
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

  // ── Transaction history ────────────────────────────────────────────────────
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
  modalBox: {
    backgroundColor: '#1A1814',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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
