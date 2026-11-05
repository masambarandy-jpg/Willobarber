import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { CC, SERIF } from './theme';
import { coiffeurReservationsApi } from '@/services/api';
import type { CancelByBarberReason, CancelResponse } from '@/types/reservation';
import {
  LATE_CANCELLATION_MS, NO_SHOW_GRACE_MS, formatDelay, formatEuro, lateCancellationAmounts, paidOnlineAmount, salonStartMs,
} from '@/utils/reservationTime';

const NOTES_MAX = 500;
const SALON_NOTES_MIN = 10;

export type BarberReservation = {
  id: number;
  client_display_name: string;
  service_name: string;
  date: string;
  time: string;
  status: string;
  client_phone?: string | null;
  payment_intent_id?: string;
  amount_paid?: string | null;
  checked_in_at?: string | null;
  parent_reservation?: number | null;
};

const lateMinutes = (r: BarberReservation) => Math.floor((Date.now() - salonStartMs(r.date, r.time)) / 60000);

// ─── Section « À traiter » ───────────────────────────────────────────────────

export function OverdueSection({ reservations, onNoShow }: {
  reservations: BarberReservation[];
  onNoShow: (reservation: BarberReservation) => void;
}) {
  if (reservations.length === 0) return null;
  return (
    <View style={styles.overdue} testID="section-a-traiter">
      <Text style={styles.overdueTitle}>⚠️ À TRAITER ({reservations.length})</Text>
      {reservations.map((r) => (
        <View key={r.id} style={styles.overdueRow}>
          <View style={styles.flex}>
            <Text style={styles.overdueName}>{r.client_display_name}</Text>
            <Text style={styles.overdueMeta}>
              {r.time.slice(0, 5)} · {r.service_name} · Retard de {lateMinutes(r)} min
            </Text>
          </View>
          <TouchableOpacity style={styles.overdueBtn} onPress={() => onNoShow(r)} testID={`btn-no-show-${r.id}`}>
            <Text style={styles.overdueBtnText}>Marquer no-show</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ─── Menu d'actions d'un RDV ─────────────────────────────────────────────────

export function ReservationActionsSheet({ reservation, onClose, onSelect }: {
  reservation: BarberReservation | null;
  onClose: () => void;
  onSelect: (reason: CancelByBarberReason) => void;
}) {
  if (!reservation) return null;

  const phone = reservation.client_phone;
  const noShowAt = salonStartMs(reservation.date, reservation.time) + NO_SHOW_GRACE_MS;
  const remaining = noShowAt - Date.now();
  const noShowDisabled = remaining >= 0 || !!reservation.checked_in_at;
  const noShowHint = reservation.checked_in_at
    ? 'Client déjà arrivé'
    : remaining >= 0 ? `Disponible dans ${formatDelay(remaining + 60000)}` : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.modalTitle}>{reservation.client_display_name}</Text>
        <Text style={styles.modalInfo}>{reservation.time.slice(0, 5)} · {reservation.service_name}</Text>

        <TouchableOpacity
          style={[styles.sheetItem, !phone && styles.disabled]}
          disabled={!phone}
          onPress={() => phone && Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`)}
        >
          <Text style={styles.sheetItemText}>📞 Appeler le client</Text>
          {!phone && <Text style={styles.sheetHint}>Numéro non renseigné</Text>}
        </TouchableOpacity>
        {reservation.parent_reservation ? (
          <Text style={[styles.sheetHint, styles.sheetNotice]} testID="child-notice">
            RDV lié à une réservation groupée : annulez la réservation principale pour annuler tout le groupe.
          </Text>
        ) : (
          <>
            <TouchableOpacity style={styles.sheetItem} onPress={() => onSelect('client_requested')}>
              <Text style={styles.sheetItemText}>❌ Annuler à sa demande</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetItem} onPress={() => onSelect('salon_unavailable')}>
              <Text style={styles.sheetItemText}>🚫 Annuler (salon)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetItem, noShowDisabled && styles.disabled]}
              disabled={noShowDisabled}
              onPress={() => onSelect('client_no_show')}
              testID="action-no-show"
            >
              <Text style={styles.sheetItemText}>🚫 Marquer no-show</Text>
              {noShowHint && <Text style={styles.sheetHint}>{noShowHint}</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

// ─── Modale de confirmation (3 motifs) ───────────────────────────────────────

export function BarberCancelModal({ reservation, reason, linkedCount, onClose, onDone }: {
  reservation: BarberReservation;
  reason: CancelByBarberReason;
  // RDV enfants que la cascade annulera aussi.
  linkedCount: number;
  onClose: () => void;
  onDone: (response: CancelResponse) => void;
}) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = salonStartMs(reservation.date, reservation.time);
  const late = start - Date.now() <= LATE_CANCELLATION_MS;
  const paid = paidOnlineAmount(reservation);
  const notesRequired = reason === 'salon_unavailable';
  const canSubmit = !loading && (!notesRequired || notes.trim().length >= SALON_NOTES_MIN);

  const content: Record<CancelByBarberReason, { title: string; warning: string; confirm: string }> = {
    client_no_show: {
      title: '🚫 Marquer comme no-show ?',
      warning: "Libère le créneau, PAS de remboursement, retire les points fidélité, envoie un email d'avertissement.",
      confirm: 'Confirmer no-show',
    },
    client_requested: {
      title: '❌ Annuler à la demande du client',
      warning: paid <= 0
        ? 'Aucun paiement en ligne à rembourser'
        : late
          ? `⚠️ Annulation tardive → frais de ${formatEuro(lateCancellationAmounts(paid).fee)}, remboursement de ${formatEuro(lateCancellationAmounts(paid).refund)}`
          : `Remboursement intégral (${formatEuro(paid)}) sera effectué`,
      confirm: 'Confirmer',
    },
    salon_unavailable: {
      title: '🚫 Annuler pour indisponibilité du salon',
      warning: 'Remboursement intégral OBLIGATOIRE (CDE Livre VI). Points fidélité conservés.',
      confirm: 'Confirmer annulation salon',
    },
  };
  const { title, warning, confirm } = content[reason];

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const trimmed = notes.trim();
      onDone(await coiffeurReservationsApi.cancelByBarber(reservation.id, { reason, ...(trimmed ? { notes: trimmed } : {}) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Annulation impossible.');
      setLoading(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalBox}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Text style={styles.modalInfo}>{reservation.client_display_name} · {reservation.time.slice(0, 5)}</Text>
            {reason === 'client_no_show' && (
              <Text style={styles.modalInfo}>Retard actuel : {lateMinutes(reservation)} min</Text>
            )}
            <View style={styles.warning}>
              <Text style={styles.warningText}>{warning}</Text>
              {linkedCount > 0 && (
                <Text style={styles.warningText} testID="barber-cancel-linked">
                  {linkedCount} RDV lié(s) seront aussi annulés.
                </Text>
              )}
            </View>

            <Text style={styles.fieldLabel}>
              {notesRequired ? `Notes (obligatoire, ${SALON_NOTES_MIN} caractères min.)` : 'Notes (optionnel)'}
            </Text>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              maxLength={NOTES_MAX}
              multiline
              placeholder="Motif, détails…"
              placeholderTextColor={CC.grayText}
              testID="input-cancel-notes"
            />
            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnBack} onPress={onClose} disabled={loading}>
                <Text style={styles.btnBackText}>Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnConfirm, !canSubmit && styles.disabled]}
                onPress={submit}
                disabled={!canSubmit}
                testID="btn-confirm-barber-cancel"
              >
                {loading
                  ? <ActivityIndicator color={CC.white} size="small" />
                  : <Text style={styles.btnConfirmText}>{confirm}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  disabled: { opacity: 0.45 },
  overdue: {
    backgroundColor: CC.errorBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(192,57,43,0.25)',
    padding: 16,
    marginBottom: 16,
  },
  overdueTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, color: CC.errorText, marginBottom: 4 },
  overdueRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingTop: 10 },
  overdueName: { fontSize: 14.5, fontWeight: '700', color: CC.black },
  overdueMeta: { fontSize: 12.5, color: CC.errorText, marginTop: 2 },
  overdueBtn: { backgroundColor: CC.errorText, borderRadius: 100, paddingVertical: 8, paddingHorizontal: 14 },
  overdueBtnText: { fontSize: 12.5, fontWeight: '700', color: CC.white },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: CC.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: Platform.OS === 'ios' ? 38 : 22,
  },
  sheetItem: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: CC.trackBg },
  sheetItemText: { fontSize: 15, fontWeight: '600', color: CC.black },
  sheetHint: { fontSize: 12, color: CC.textSecondary, marginTop: 3 },
  sheetNotice: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: CC.trackBg },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 18 },
  modalBox: { backgroundColor: CC.white, borderRadius: 20, padding: 22, width: '100%', maxWidth: 480, maxHeight: '90%' },
  modalTitle: { fontFamily: SERIF, fontWeight: '700', fontSize: 21, color: CC.black },
  modalInfo: { fontSize: 13.5, color: CC.textSecondary, marginTop: 6, marginBottom: 2 },
  warning: {
    backgroundColor: CC.errorBg,
    borderLeftWidth: 3,
    borderLeftColor: CC.errorText,
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
  },
  warningText: { fontSize: 13.5, lineHeight: 19, color: CC.black },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: CC.black, marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: CC.inputBorder,
    borderRadius: 10,
    padding: 12,
    minHeight: 76,
    fontSize: 14,
    color: CC.black,
    textAlignVertical: 'top',
  },
  error: { fontSize: 13, color: CC.errorText, marginTop: 10 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 18 },
  btnBack: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 100, borderWidth: 1, borderColor: CC.inputBorder, paddingVertical: 13 },
  btnBackText: { fontSize: 14, fontWeight: '700', color: CC.black },
  btnConfirm: { flex: 2, alignItems: 'center', justifyContent: 'center', borderRadius: 100, backgroundColor: CC.errorText, paddingVertical: 13 },
  btnConfirmText: { fontSize: 14, fontWeight: '700', color: CC.white, textAlign: 'center' },
});
