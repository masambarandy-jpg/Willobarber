import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CoiffeurScreen from '@/components/coiffeur/CoiffeurScreen';
import { BagIcon } from '@/components/coiffeur/Icons';
import { CC, SERIF } from '@/components/coiffeur/theme';
import BoutiqueOrderDetailModal, {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  fmtEur,
} from '@/components/BoutiqueOrderDetailModal';
import { useCoiffeurNotifications } from '@/contexts/CoiffeurNotificationsContext';
import { coiffeurBoutiqueApi } from '@/services/api';
import type { StaffBoutiqueOrder } from '@/types';

const PERIODS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: '7 derniers jours' },
] as const;

type PeriodKey = (typeof PERIODS)[number]['key'];

function formatOrderDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })} · ${time}`;
}

export default function CoiffeurCommandesScreen() {
  const { ordersVersion } = useCoiffeurNotifications();
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [orders, setOrders] = useState<StaffBoutiqueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<StaffBoutiqueOrder | null>(null);

  const load = useCallback(async () => {
    try {
      setOrders(await coiffeurBoutiqueApi.orders(period));
      setError(false);
    } catch (e) {
      console.log('ERREUR COMMANDES — GET:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [period]);

  // ordersVersion : nouvelle commande ou statut modifié reçu en temps réel (SSE).
  useEffect(() => {
    load();
  }, [load, ordersVersion]);

  const total = orders.reduce((sum, o) => sum + parseFloat(o.total), 0);

  return (
    <>
      <CoiffeurScreen active="commandes">
        <Text style={styles.title}>Commandes</Text>
        <Text style={styles.subtitle}>
          {orders.length} commande{orders.length > 1 ? 's' : ''} · {fmtEur(total)}
        </Text>

        <View style={styles.tabsRow}>
          {PERIODS.map((p) => {
            const active = p.key === period;
            return (
              <TouchableOpacity
                key={p.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => {
                  setLoading(true);
                  setPeriod(p.key);
                }}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator color={CC.gold} style={{ marginTop: 30 }} />
        ) : error ? (
          <Text style={styles.empty}>Impossible de charger les commandes.</Text>
        ) : orders.length === 0 ? (
          <View style={styles.emptyWrap}>
            <BagIcon color={CC.grayText} size={30} />
            <Text style={styles.emptyTitle}>Aucune commande</Text>
            <Text style={styles.empty}>Les commandes payées apparaîtront ici en temps réel.</Text>
          </View>
        ) : (
          orders.map((o) => {
            const nbArticles = o.items.reduce((n, i) => n + i.quantite, 0);
            const color = ORDER_STATUS_COLORS[o.status];
            return (
              <TouchableOpacity key={o.id} style={styles.card} onPress={() => setSelected(o)} activeOpacity={0.7}>
                <View style={styles.iconWrap}>
                  <Text style={styles.deliveryEmoji}>{o.delivery_type === 'domicile' ? '📦' : '🏪'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{o.client_name}</Text>
                  <Text style={styles.cardDesc} numberOfLines={1}>
                    {nbArticles} article{nbArticles > 1 ? 's' : ''} · {o.items.map((i) => i.product.nom).join(', ')}
                  </Text>
                  <Text style={styles.cardMeta}>{formatOrderDate(o.created_at)} · {o.numero}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.cardTotal}>{fmtEur(o.total)}</Text>
                  <View style={[styles.pill, { backgroundColor: color?.bg ?? CC.grayBg }]}>
                    <Text style={[styles.pillText, { color: color?.text ?? CC.grayText }]}>
                      {ORDER_STATUS_LABELS[o.status]}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </CoiffeurScreen>

      <BoutiqueOrderDetailModal
        orderId={selected?.id ?? null}
        initial={selected ?? undefined}
        onClose={() => setSelected(null)}
        onUpdated={(updated) => setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))}
      />
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: SERIF, fontWeight: '600', fontSize: 30, color: CC.black },
  subtitle: { fontSize: 13, fontWeight: '700', color: CC.goldDark, marginTop: 4, marginBottom: 18 },
  tabsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tab: {
    backgroundColor: CC.white,
    borderWidth: 1,
    borderColor: CC.border,
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tabActive: { backgroundColor: CC.black, borderColor: CC.black },
  tabText: { fontSize: 12.5, fontWeight: '600', color: CC.textSecondary },
  tabTextActive: { color: CC.white },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CC.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,168,76,0.15)',
  },
  deliveryEmoji: { fontSize: 18 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: CC.black },
  cardDesc: { fontSize: 12.5, color: CC.textSecondary, marginTop: 2 },
  cardMeta: { fontSize: 11, color: CC.textSecondary, marginTop: 3 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  cardTotal: { fontSize: 14, fontWeight: '700', color: CC.black },
  pill: { borderRadius: 100, paddingVertical: 3, paddingHorizontal: 8 },
  pillText: { fontSize: 10.5, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  emptyTitle: { fontFamily: SERIF, fontSize: 18, color: CC.black, marginTop: 6 },
  empty: { fontSize: 14, color: CC.textSecondary, textAlign: 'center' },
});
