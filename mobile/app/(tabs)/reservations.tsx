import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useReservations } from '@/hooks/useReservations';
import { ReservationCard } from '@/components/home/ReservationCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants';
import { RESERVATION_STATUS } from '@/constants';
import type { Reservation } from '@/types';

type Tab = 'upcoming' | 'past';

export default function ReservationsScreen() {
  const router = useRouter();
  const { upcoming, past, isLoading, refetch, cancel } = useReservations();

  const [tab, setTab] = useState<Tab>('upcoming');
  const [refreshing, setRefreshing] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleCancelPress = (res: Reservation) => {
    setCancelTarget(res);
    setCancelReason('');
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancel(cancelTarget.id, cancelReason);
      setCancelTarget(null);
      Alert.alert('Annulée', 'Votre réservation a été annulée.');
    } catch {
      Alert.alert('Erreur', "Impossible d'annuler cette réservation.");
    } finally {
      setCancelling(false);
    }
  };

  const currentList = tab === 'upcoming' ? upcoming : past;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mes Rendez-vous</Text>
        <View style={styles.tabs}>
          {(['upcoming', 'past'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'upcoming' ? `À venir (${upcoming.length})` : `Historique (${past.length})`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
        }
      >
        {currentList.length === 0 ? (
          <EmptyState
            icon={tab === 'upcoming' ? '📅' : '📂'}
            title={tab === 'upcoming' ? 'Aucun rendez-vous à venir' : 'Aucun historique'}
            description={
              tab === 'upcoming'
                ? 'Prenez un rendez-vous pour voir votre prochain passage au salon.'
                : 'Votre historique de réservations apparaîtra ici.'
            }
            actionLabel={tab === 'upcoming' ? 'Réserver maintenant' : undefined}
            onAction={tab === 'upcoming' ? () => router.push('/(tabs)/book') : undefined}
          />
        ) : (
          <View style={styles.list}>
            {currentList.map((res) => (
              <View key={res.id}>
                <ReservationCard reservation={res} />
                {(res.status === 'pending' || res.status === 'confirmed') && (
                  <Button
                    label="Annuler ce rendez-vous"
                    variant="danger"
                    size="sm"
                    style={{ marginTop: Spacing.xs } as never}
                    onPress={() => handleCancelPress(res)}
                  />
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Cancel Modal */}
      <Modal
        visible={!!cancelTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelTarget(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Annuler la réservation</Text>
            <Text style={styles.modalSub}>
              {cancelTarget?.service_name} avec {cancelTarget?.barber_name}
            </Text>

            <Text style={styles.reasonLabel}>Motif d'annulation (optionnel)</Text>
            <TextInput
              style={styles.reasonInput}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Ex: Indisponibilité..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalWarning}>
              <Text style={styles.modalWarningIcon}>⚠️</Text>
              <Text style={styles.modalWarningText}>
                Une annulation tardive (moins de 24h) sera comptabilisée dans votre historique.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <Button
                label="Garder le RDV"
                variant="secondary"
                onPress={() => setCancelTarget(null)}
                fullWidth={false}
                style={{ flex: 1 } as never}
              />
              <Button
                label="Confirmer l'annulation"
                variant="danger"
                loading={cancelling}
                onPress={handleConfirmCancel}
                fullWidth={false}
                style={{ flex: 1 } as never}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    gap: Spacing.md,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  tabActive: { backgroundColor: Colors.gold },
  tabText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  tabTextActive: { color: Colors.textInverse, fontWeight: FontWeight.bold },
  content: { padding: Spacing.xl, flexGrow: 1 },
  list: { gap: Spacing.md },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalSub: { fontSize: FontSize.base, color: Colors.textSecondary },
  reasonLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  reasonInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalWarning: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.warningSubtle,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.warning,
    padding: Spacing.md,
    alignItems: 'flex-start',
  },
  modalWarningIcon: { fontSize: 16 },
  modalWarningText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  modalActions: { flexDirection: 'row', gap: Spacing.sm },
});
