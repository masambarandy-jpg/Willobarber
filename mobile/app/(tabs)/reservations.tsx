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
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAuthModal } from '@/contexts/AuthModalContext';
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
  { label: 'BRONZE', min: 0,   threshold: '0 pts',  color: '#8B6914' },
  { label: 'ARGENT', min: 200, threshold: '200 pts', color: '#6B6560' },
  { label: 'OR',     min: 500, threshold: '500 pts', color: '#C9A84C' },
];

const HISTORIQUE = [
  { jour: '12', mois: 'AVR',  service: 'Signature WilloBarber', barbier: 'W', barbierNom: 'Willo', couleur: '#C9A84C', prix: '45€', annee: '2026' },
  { jour: '02', mois: 'MARS', service: 'Taille & rasage',        barbier: 'M', barbierNom: 'Malik', couleur: '#7A3B1E', prix: '28€', annee: '2026' },
  { jour: '18', mois: 'JANV', service: 'Le Rituel',              barbier: 'W', barbierNom: 'Willo', couleur: '#C9A84C', prix: '75€', annee: '2026' },
  { jour: '05', mois: 'DÉC',  service: 'Coupe express',          barbier: 'I', barbierNom: 'Idris', couleur: '#1A6B4A', prix: '28€', annee: '2025' },
];

const FAVORIS = [
  { nom: 'Signature WilloBarber', dur: '45 min', prix: '45€', count: '8×', date: '12 avr.' },
  { nom: 'Taille & rasage',        dur: '30 min', prix: '28€', count: '5×', date: '2 mars'  },
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
  const { showLoginModal } = useAuthModal();
  const { isLoading, refetch, cancel } = useReservations();
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

  if (!isAuthenticated || !user) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 28 }]}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 10, textAlign: 'center' }}>
          Mon Espace
        </Text>
        <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
          Connectez-vous pour accéder à vos rendez-vous, votre historique et vos points fidélité.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#C9A84C', borderRadius: 100, paddingVertical: 15, paddingHorizontal: 40 }}
          onPress={() => showLoginModal(undefined, 'Connectez-vous pour accéder à votre espace.')}
          activeOpacity={0.85}
        >
          <Text style={{ color: '#1A1208', fontWeight: '700', fontSize: 15 }}>Se connecter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const username = user?.username || user?.first_name || 'Client';
  const nextTarget  = getNextTarget(MOCK_LOYALTY.points);
  const ptsRestants = nextTarget - MOCK_LOYALTY.points;

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
      Alert.alert('Erreur', "Impossible d'annuler cette réservation.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Sticky top bar */}
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#C9A84C" />}
      >

        {/* ── 1. HEADER ─────────────────────────────────────────────── */}
        <Text style={styles.kicker}>— BONJOUR {username.toUpperCase()}</Text>
        <Text style={styles.pageTitle}>
          Votre espace, <GoldItalic>au poil.</GoldItalic>
        </Text>
        <TouchableOpacity style={styles.newRdvBtn} onPress={() => router.push('/(tabs)/book')} activeOpacity={0.85}>
          <Text style={styles.newRdvBtnText}>📅  Nouveau rendez-vous →</Text>
        </TouchableOpacity>

        {/* ── 2. GRILLE STATS ───────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>12</Text>
            <Text style={styles.statLabel}>VISITES</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>28</Text>
            <Text style={styles.statNumSub}>jours</Text>
            <Text style={styles.statLabel}>DERNIÈRE VISITE</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#C9A84C' }]}>{MOCK_LOYALTY.points}</Text>
            <Text style={styles.statNumSub}>/ 1000</Text>
            <Text style={styles.statLabel}>POINTS FIDÉLITÉ</Text>
          </View>
        </View>

        {/* ── 3. PROCHAIN RENDEZ-VOUS ───────────────────────────────── */}
        <View style={styles.nextRdvBadgeWrap}>
          <View style={styles.nextRdvBadge}>
            <Text style={styles.nextRdvBadgeText}>PROCHAIN RENDEZ-VOUS · DANS 4 JOURS</Text>
          </View>
        </View>

        <View style={styles.mockRdvCard}>
          <View style={styles.mockRdvInner}>
            <View style={styles.mockDateBox}>
              <Text style={styles.mockDateNum}>23</Text>
              <Text style={styles.mockDateMon}>MAI</Text>
              <Text style={styles.mockDateDay}>SAM.</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mockRdvService}>
                Coupe + <GoldItalic>Barbe</GoldItalic>
              </Text>
              <View style={styles.mockRdvInfoRow}>
                <Text style={styles.mockRdvKey}>Heure</Text>
                <Text style={styles.mockRdvVal}>10:30</Text>
              </View>
              <View style={styles.mockRdvInfoRow}>
                <Text style={styles.mockRdvKey}>Barbier</Text>
                <Text style={styles.mockRdvVal}>Willo</Text>
              </View>
              <View style={styles.mockRdvInfoRow}>
                <Text style={styles.mockRdvKey}>Adresse</Text>
                <Text style={styles.mockRdvVal}>Rue Auguste Van Zande 78</Text>
              </View>
            </View>
          </View>

          <View style={styles.soldePill}>
            <Text style={styles.soldeText}>Solde 42,70€ au salon</Text>
          </View>

          <TouchableOpacity style={styles.btnPrimary} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryText}>📅  Ajouter au calendrier</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity style={[styles.btnOutline, { flex: 1 }]} activeOpacity={0.85}>
              <Text style={styles.btnOutlineText}>↺ Reprogrammer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnDangerSm} activeOpacity={0.85}>
              <Text style={styles.btnDangerSmText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 4. REPRENEZ LÀ OÙ VOUS EN ÉTIEZ ────────────────────── */}
        <Text style={styles.sectionTitle}>Reprenez là où vous en étiez</Text>

        <View style={styles.resumeCard}>
          <View style={styles.resumeBadge}>
            <Text style={styles.resumeBadgeText}>VOTRE COUPE HABITUELLE · 8 FOIS</Text>
          </View>
          <View style={styles.resumeRow}>
            <View style={styles.scissorsBox}>
              <Text style={{ fontSize: 22 }}>✂️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resumeServiceName}>Signature WilloBarber</Text>
              <Text style={styles.resumeServiceMeta}>45 min · avec Willo · 45€</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.btnPrimary, { flex: 1 }]}
              onPress={() => router.push('/(tabs)/book')}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>Reprendre la même coupe</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnOutline, { paddingHorizontal: 18 }]} activeOpacity={0.85}>
              <Text style={styles.btnOutlineText}>✏️ Adapter</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 5. VOS FAVORIS ────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Vos favoris</Text>

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

        {/* ── 6. HISTORIQUE DES RÉSERVATIONS ────────────────────────── */}
        <Text style={styles.sectionTitle}>Historique</Text>

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

        {filteredHist.length === 0
          ? <Text style={styles.emptyHist}>Aucun historique à afficher.</Text>
          : filteredHist.map((h, i) => (
            <View key={i} style={styles.histCard}>
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
                <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/book')}>
                  <Text style={{ color: '#C9A84C', fontSize: 15 }}>↺</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn}>
                  <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15 }}>↓</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        }

        {/* ── 7. PROGRAMME FIDÉLITÉ ─────────────────────────────────── */}
        <Text style={[styles.sectionKicker, { marginTop: 28 }]}>PROGRAMME FIDÉLITÉ</Text>
        <View style={styles.loyaltyCard}>
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

        {/* ── 8. HISTORIQUE DES POINTS ──────────────────────────────── */}
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

  scroll:        { flex: 1 },
  scrollContent: { padding: 22, paddingBottom: 56 },

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
