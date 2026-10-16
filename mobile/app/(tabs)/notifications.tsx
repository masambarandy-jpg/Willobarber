import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Fonts } from '@/constants';
import { useClientNotifications } from '@/contexts/ClientNotificationsContext';
import { RecommendationModal } from '@/components/RecommendationModal';
import type { ClientNotification, ClientNotificationType } from '@/types';
import { goBackOr } from '@/services/navigation';

const GOLD = '#C9A84C';
const GREY = '#6B6560';

const ICONS: Record<ClientNotificationType, React.ComponentProps<typeof Feather>['name']> = {
  recommendation: 'star',
  seasonal_reminder: 'clock',
  invoice: 'file-text',
  boutique_invoice: 'package',
};

// Factures RDV et boutique : même bouton « Télécharger la facture » (lien signé).
const isInvoice = (n: ClientNotification) => n.type === 'invoice' || n.type === 'boutique_invoice';

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' });
}

export default function ClientNotificationsScreen() {
  const router = useRouter();
  const { notifications, loading, refresh, markRead } = useClientNotifications();
  const [recoNotif, setRecoNotif] = useState<ClientNotification | null>(null);

  const open = (n: ClientNotification) => {
    if (n.unread) markRead(n.id);
    if (n.type === 'recommendation') setRecoNotif(n);
    else if (n.type === 'seasonal_reminder') router.push('/(tabs)/book');
  };

  const downloadInvoice = (n: ClientNotification) => {
    if (n.unread) markRead(n.id);
    if (n.data.invoice_url) Linking.openURL(n.data.invoice_url);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOr('/(tabs)')} hitSlop={10}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading && notifications.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={GOLD} /></View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={GOLD} />}
          ListEmptyComponent={
            <Text style={styles.empty}>Aucune notification pour le moment.</Text>
          }
          renderItem={({ item: n }) => (
            <TouchableOpacity
              style={[styles.card, n.unread && styles.cardUnread]}
              onPress={() => open(n)}
              activeOpacity={isInvoice(n) ? 1 : 0.85}
              testID={`notif-${n.type}`}
            >
              <View style={styles.iconCircle}>
                <Feather name={ICONS[n.type] ?? 'bell'} size={17} color={GOLD} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={2}>{n.title}</Text>
                  <Text style={styles.time}>{formatCreatedAt(n.created_at)}</Text>
                </View>
                <Text style={styles.desc}>{n.desc}</Text>
                {isInvoice(n) && n.data.invoice_url && (
                  <TouchableOpacity style={styles.invoiceBtn} onPress={() => downloadInvoice(n)} activeOpacity={0.85}>
                    <Feather name="download" size={14} color="#1A1208" />
                    <Text style={styles.invoiceBtnText}>Télécharger la facture</Text>
                  </TouchableOpacity>
                )}
                {n.type === 'recommendation' && (
                  <Text style={styles.cta}>Voir les créneaux proposés ›</Text>
                )}
                {n.type === 'seasonal_reminder' && (
                  <Text style={styles.cta}>Réserver ›</Text>
                )}
              </View>
              {n.unread && <View style={styles.dot} />}
            </TouchableOpacity>
          )}
        />
      )}

      <RecommendationModal
        visible={recoNotif !== null}
        onClose={() => setRecoNotif(null)}
        fallbackSlots={recoNotif?.data.suggested_slots}
        fallbackHabits={recoNotif?.data.habits}
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
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 0) + 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: { fontFamily: Fonts.semiBold, fontSize: 22, fontWeight: '600', color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  empty: { color: GREY, textAlign: 'center', marginTop: 60, fontSize: 14 },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#1A1814',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardUnread: { borderColor: 'rgba(201,168,76,0.45)' },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(201,168,76,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  title: { flex: 1, fontSize: 14.5, fontWeight: '700', color: '#fff' },
  time: { fontSize: 11.5, color: GREY },
  desc: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 19 },
  cta: { fontSize: 13, color: GOLD, fontWeight: '600', marginTop: 8 },
  invoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: GOLD,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 10,
  },
  invoiceBtnText: { color: '#1A1208', fontWeight: '700', fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GOLD, marginTop: 4 },
});
