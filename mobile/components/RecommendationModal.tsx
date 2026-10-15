import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Fonts } from '@/constants';
import { recommendationsApi } from '@/services/api';
import { ACOMPTE_FIXE, fmtPrice } from '@/components/booking/data';
import type { ClientHabits, SuggestedSlot } from '@/types';

const GOLD = '#C9A84C';
const CARD = '#1A1814';
const GREY = '#6B6560';

// Après 5 « Voir d'autres créneaux » consécutifs sans réservation, on propose
// d'ouvrir le planning complet plutôt que de continuer à rafraîchir.
const MAX_REFRESHES_BEFORE_MANUAL = 5;
const ALTERNATIVES_PER_PAGE = 3;

type Phase = 'loading' | 'ideal' | 'alternatives' | 'confirm' | 'empty';
type Service = NonNullable<ClientHabits['favorite_service']>;

interface Props {
  visible: boolean;
  onClose: () => void;
  // Payload de la notification : affiché si l'API ne répond pas.
  fallbackSlots?: SuggestedSlot[];
  fallbackHabits?: ClientHabits;
}

const slotKey = (s: SuggestedSlot) => `${s.date}T${s.time}`;

function formatSlotDate(iso: string): string {
  const label = format(new Date(`${iso}T00:00:00`), 'EEEE d MMMM', { locale: fr });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatSlotTime(hhmm: string): string {
  return hhmm.replace(':', 'h');
}

export function RecommendationModal({ visible, onClose, fallbackSlots, fallbackHabits }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [service, setService] = useState<Service | null>(null);
  const [preferred, setPreferred] = useState<SuggestedSlot | null>(null);
  const [alternatives, setAlternatives] = useState<SuggestedSlot[]>([]);
  // Tous les créneaux déjà montrés au client : envoyés au backend (exclude)
  // pour que chaque rafraîchissement propose 3 créneaux réellement nouveaux.
  const [seen, setSeen] = useState<string[]>([]);
  const [refreshCount, setRefreshCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [selected, setSelected] = useState<SuggestedSlot | null>(null);
  const [previousPhase, setPreviousPhase] = useState<Phase>('ideal');

  const showFirstBatch = useCallback((slots: SuggestedSlot[], habits?: ClientHabits | null) => {
    const ideal = slots.find((s) => s.is_preferred) ?? null;
    const alts = slots.filter((s) => !s.is_preferred).slice(0, ALTERNATIVES_PER_PAGE);
    setService(habits?.favorite_service ?? null);
    setPreferred(ideal);
    setAlternatives(alts);
    if (ideal) {
      setSeen([slotKey(ideal)]);
      setPhase('ideal');
    } else if (alts.length) {
      setSeen(alts.map(slotKey));
      setPhase('alternatives');
    } else {
      setPhase('empty');
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setPhase('loading');
    setSelected(null);
    setRefreshCount(0);
    setExhausted(false);

    recommendationsApi.get()
      .then((data) => {
        if (cancelled) return;
        if (data.type !== 'regular') {
          setPhase('empty');
          return;
        }
        showFirstBatch(data.suggested_slots, data.habits);
      })
      .catch(() => {
        if (!cancelled) showFirstBatch(fallbackSlots ?? [], fallbackHabits);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, fallbackSlots, fallbackHabits, showFirstBatch]);

  const showAlternatives = () => {
    // Les 3 alternatives du premier lot sont déjà chargées : pas d'appel réseau.
    setSeen((prev) => [...prev, ...alternatives.map(slotKey)]);
    setPhase(alternatives.length ? 'alternatives' : 'empty');
    if (!alternatives.length) setExhausted(true);
  };

  const refreshAlternatives = async () => {
    setRefreshing(true);
    try {
      const data = await recommendationsApi.get(seen);
      const fresh = data.suggested_slots
        .filter((s) => !s.is_preferred && !seen.includes(slotKey(s)))
        .slice(0, ALTERNATIVES_PER_PAGE);
      setRefreshCount((c) => c + 1);
      if (!fresh.length) {
        setExhausted(true);
        return;
      }
      setAlternatives(fresh);
      setSeen((prev) => [...prev, ...fresh.map(slotKey)]);
    } catch {
      setExhausted(true);
    } finally {
      setRefreshing(false);
    }
  };

  const select = (slot: SuggestedSlot) => {
    setPreviousPhase(phase);
    setSelected(slot);
    setPhase('confirm');
  };

  const openPlanning = () => {
    onClose();
    router.push('/(tabs)/book');
  };

  const pay = (amount: 'deposit' | 'full') => {
    if (!selected) return;
    onClose();
    // Réutilise le tunnel de paiement Stripe existant (étape 4 de book.tsx),
    // créneau et prestation pré-remplis.
    router.push({
      pathname: '/(tabs)/book',
      params: {
        quickbook: 'true',
        recoServiceId: String(selected.service_id),
        date: selected.date,
        heure: selected.time,
        amount,
      },
    });
  };

  const price = service?.price ?? 0;
  const canChooseManually = refreshCount >= MAX_REFRESHES_BEFORE_MANUAL || exhausted;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>RECOMMANDATION</Text>
              <Text style={styles.title}>
                {phase === 'confirm' ? 'Confirmer le créneau' : 'Votre prochain passage'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} testID="reco-close">
              <Feather name="x" size={22} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {phase === 'loading' && (
              <View style={styles.center}>
                <ActivityIndicator color={GOLD} />
              </View>
            )}

            {phase === 'ideal' && preferred && (
              <>
                <View style={styles.idealCard}>
                  <View style={styles.idealBadge}>
                    <Feather name="star" size={11} color="#1A1208" />
                    <Text style={styles.idealBadgeText}>CRÉNEAU IDÉAL</Text>
                  </View>
                  <Text style={styles.idealDate}>{formatSlotDate(preferred.date)}</Text>
                  <Text style={styles.idealTime}>{formatSlotTime(preferred.time)}</Text>
                  {service && (
                    <Text style={styles.idealService}>{service.name} · {fmtPrice(service.price)}</Text>
                  )}
                  <Text style={styles.reason}>{preferred.reason}</Text>
                </View>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => select(preferred)} activeOpacity={0.85} testID="reco-book-ideal">
                  <Text style={styles.primaryBtnText}>Réserver</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={showAlternatives} activeOpacity={0.85} testID="reco-more">
                  <Text style={styles.secondaryBtnText}>Voir d'autres créneaux</Text>
                </TouchableOpacity>
              </>
            )}

            {phase === 'alternatives' && (
              <>
                <Text style={styles.sectionLabel}>
                  {preferred ? 'Autres créneaux proches de vos habitudes' : 'Votre créneau habituel est pris — voici des alternatives'}
                </Text>
                <View style={styles.pills}>
                  {alternatives.map((slot) => (
                    <TouchableOpacity
                      key={slotKey(slot)}
                      style={styles.pill}
                      onPress={() => select(slot)}
                      activeOpacity={0.85}
                      testID="reco-pill"
                    >
                      <Text style={styles.pillDate}>{formatSlotDate(slot.date)}</Text>
                      <Text style={styles.pillTime}>{formatSlotTime(slot.time)}</Text>
                      <Text style={styles.pillReason}>{slot.reason}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {exhausted && (
                  <Text style={styles.hint}>Plus d'autres créneaux proches de vos habitudes.</Text>
                )}
                {!exhausted && (
                  <TouchableOpacity
                    style={[styles.secondaryBtn, refreshing && { opacity: 0.6 }]}
                    onPress={refreshAlternatives}
                    disabled={refreshing}
                    activeOpacity={0.85}
                    testID="reco-refresh"
                  >
                    {refreshing
                      ? <ActivityIndicator color={GOLD} size="small" />
                      : <Text style={styles.secondaryBtnText}>Voir d'autres créneaux</Text>}
                  </TouchableOpacity>
                )}
                {canChooseManually && (
                  <TouchableOpacity style={styles.linkBtn} onPress={openPlanning} activeOpacity={0.85} testID="reco-manual">
                    <Feather name="calendar" size={15} color={GOLD} />
                    <Text style={styles.linkBtnText}>Choisir moi-même</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {phase === 'confirm' && selected && (
              <>
                <View style={styles.recap}>
                  <RecapRow label="Date" value={formatSlotDate(selected.date)} />
                  <RecapRow label="Heure" value={formatSlotTime(selected.time)} />
                  <RecapRow label="Prestation" value={service?.name ?? '—'} />
                  <RecapRow label="Prix" value={fmtPrice(price)} last />
                </View>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => pay('deposit')} activeOpacity={0.85} testID="reco-pay-deposit">
                  <Text style={styles.primaryBtnText}>Payer l'acompte {fmtPrice(ACOMPTE_FIXE)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => pay('full')} activeOpacity={0.85} testID="reco-pay-full">
                  <Text style={styles.secondaryBtnText}>Payer la totalité ({fmtPrice(price)})</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkBtn} onPress={() => setPhase(previousPhase)} activeOpacity={0.85}>
                  <Feather name="arrow-left" size={15} color={GOLD} />
                  <Text style={styles.linkBtnText}>Changer de créneau</Text>
                </TouchableOpacity>
              </>
            )}

            {phase === 'empty' && (
              <>
                <Text style={styles.hint}>
                  Aucune suggestion disponible pour le moment — vous avez peut-être déjà un rendez-vous prévu.
                </Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={openPlanning} activeOpacity={0.85}>
                  <Text style={styles.primaryBtnText}>Ouvrir le planning</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function RecapRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.recapRow, !last && styles.recapRowBorder]}>
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={styles.recapValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0D0C0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    padding: 22,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  kicker: { fontSize: 10.5, fontWeight: '700', letterSpacing: 2, color: GOLD, marginBottom: 4 },
  title: { fontFamily: Fonts.semiBold, fontSize: 24, fontWeight: '600', color: '#fff' },
  center: { paddingVertical: 40, alignItems: 'center' },

  idealCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: GOLD,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  idealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: GOLD,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 14,
  },
  idealBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: '#1A1208' },
  idealDate: { fontFamily: Fonts.semiBold, fontSize: 20, color: '#fff' },
  // Police système : les chiffres elzéviriens de Cormorant rendent « 14h00 » comme « 14hoo ».
  idealTime: { fontSize: 42, fontWeight: '700', color: GOLD, marginVertical: 4, letterSpacing: 0.5 },
  idealService: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  reason: { fontSize: 12, color: GREY, marginTop: 6 },

  sectionLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12, lineHeight: 18 },
  pills: { gap: 10, marginBottom: 16 },
  pill: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 10,
  },
  pillDate: { fontSize: 15, color: '#fff', fontFamily: Fonts.semiBold, flexShrink: 1 },
  pillTime: { fontSize: 18, fontWeight: '700', color: GOLD, marginLeft: 'auto' },
  pillReason: { width: '100%', fontSize: 11.5, color: GREY, marginTop: 3 },

  recap: { backgroundColor: CARD, borderRadius: 16, paddingHorizontal: 16, marginBottom: 18 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, gap: 12 },
  recapRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  recapLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 1, color: GREY, textTransform: 'uppercase' },
  recapValue: { fontSize: 15, color: '#fff', fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  hint: { fontSize: 13, color: GREY, textAlign: 'center', marginBottom: 14, lineHeight: 19 },

  primaryBtn: {
    backgroundColor: GOLD,
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: '#1A1208', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryBtnText: { color: GOLD, fontWeight: '600', fontSize: 14.5 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  linkBtnText: { color: GOLD, fontWeight: '600', fontSize: 14 },
});
