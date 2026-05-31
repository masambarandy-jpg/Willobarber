import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useServices } from '@/hooks/useServices';
import { useBarbers } from '@/hooks/useBarbers';
import { useSlots } from '@/hooks/useSlots';
import { reservationsApi, slotsApi } from '@/services/api';
import { ServiceCard } from '@/components/booking/ServiceCard';
import { BarberCard } from '@/components/booking/BarberCard';
import { TimeSlotPicker } from '@/components/booking/TimeSlotPicker';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/constants';
import { SERVICE_CATEGORIES } from '@/constants';
import type { Barber, Service, TimeSlot } from '@/types';

type Step = 'service' | 'barber' | 'datetime' | 'confirm';

const STEPS: Record<Step, { label: string; index: number }> = {
  service: { label: 'Service', index: 0 },
  barber: { label: 'Barbier', index: 1 },
  datetime: { label: 'Date & Heure', index: 2 },
  confirm: { label: 'Confirmation', index: 3 },
};

const STEP_ORDER: Step[] = ['service', 'barber', 'datetime', 'confirm'];

function StepIndicator({ current }: { current: Step }) {
  return (
    <View style={stepStyles.row}>
      {STEP_ORDER.map((step, i) => {
        const isActive = step === current;
        const isDone = STEPS[step].index < STEPS[current].index;
        return (
          <React.Fragment key={step}>
            <View
              style={[
                stepStyles.dot,
                isDone && stepStyles.dotDone,
                isActive && stepStyles.dotActive,
              ]}
            >
              <Text style={[stepStyles.dotLabel, (isActive || isDone) && stepStyles.dotLabelActive]}>
                {isDone ? '✓' : String(i + 1)}
              </Text>
            </View>
            {i < STEP_ORDER.length - 1 && (
              <View style={[stepStyles.line, isDone && stepStyles.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.base,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
  },
  dotActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  dotDone: { backgroundColor: Colors.goldSubtle, borderColor: Colors.gold },
  dotLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textMuted },
  dotLabelActive: { color: Colors.textInverse },
  line: { flex: 1, height: 1.5, backgroundColor: Colors.surfaceBorder },
  lineDone: { backgroundColor: Colors.gold },
});

// Simple inline calendar
function DatePicker({ selected, onSelect }: { selected: string | null; onSelect: (d: string) => void }) {
  const today = new Date();
  const dates: Date[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={dateStyles.row}>
      {dates.map((d) => {
        const iso = d.toISOString().split('T')[0];
        const isSelected = iso === selected;
        const dayLabel = d.toLocaleDateString('fr-BE', { weekday: 'short' });
        const dayNum = d.getDate();
        const monthLabel = d.toLocaleDateString('fr-BE', { month: 'short' });

        return (
          <View
            key={iso}
            style={[dateStyles.dateChip, isSelected && dateStyles.dateChipSelected]}
            // @ts-ignore — Pressable not used here to keep this simple
            onTouchEnd={() => onSelect(iso)}
          >
            <Text style={[dateStyles.dayLabel, isSelected && dateStyles.selectedText]}>{dayLabel}</Text>
            <Text style={[dateStyles.dayNum, isSelected && dateStyles.selectedNum]}>{dayNum}</Text>
            <Text style={[dateStyles.monthLabel, isSelected && dateStyles.selectedText]}>{monthLabel}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const dateStyles = StyleSheet.create({
  row: { paddingVertical: Spacing.sm, gap: Spacing.sm, paddingHorizontal: 2 },
  dateChip: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    minWidth: 64,
  },
  dateChipSelected: { backgroundColor: Colors.goldSubtle, borderColor: Colors.gold },
  dayLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'capitalize' },
  dayNum: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginVertical: 2 },
  monthLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  selectedText: { color: Colors.gold },
  selectedNum: { color: Colors.gold },
});


export default function BookScreen() {
  const router = useRouter();
  const { services, isLoading: servicesLoading } = useServices();
  const { barbers, isLoading: barbersLoading } = useBarbers();

  const [step, setStep] = useState<Step>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { available: availableSlots, isLoading: slotsLoading, error: slotsError } =
    useSlots(selectedBarber?.id ?? null, selectedDate);

  const goNext = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1]);
  };

  const goBack = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  };

  const handleSelectSlot = async (slot: TimeSlot) => {
    setSelectedSlot(slot);
    if (selectedBarber && selectedDate) {
      try {
        await slotsApi.lock(selectedBarber.id, selectedDate, slot.start_time);
      } catch {
        // best effort
      }
    }
  };

  const handleConfirm = async () => {
    if (!selectedService || !selectedBarber || !selectedDate || !selectedSlot) return;
    setSubmitting(true);
    try {
      await reservationsApi.create({
        barber: selectedBarber.id,
        service: selectedService.id,
        date: selectedDate,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        notes,
      });
      Alert.alert(
        '✅ Réservation confirmée !',
        `Votre rendez-vous pour ${selectedService.name} avec ${selectedBarber.full_name} a bien été enregistré.`,
        [
          {
            text: 'Voir mes RDV',
            onPress: () => {
              router.push('/(tabs)/reservations');
              resetForm();
            },
          },
        ],
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      const detail = msg ? Object.values(msg).flat().join('\n') : 'Une erreur est survenue.';
      Alert.alert('Erreur', detail);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep('service');
    setSelectedService(null);
    setSelectedBarber(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setNotes('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Réserver</Text>
        <Text style={styles.subtitle}>
          {step === 'service' && 'Choisissez votre service'}
          {step === 'barber' && 'Choisissez votre barbier'}
          {step === 'datetime' && 'Choisissez date & heure'}
          {step === 'confirm' && 'Confirmez votre réservation'}
        </Text>
        <StepIndicator current={step} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Step: Service ─────────────────────────────── */}
        {step === 'service' && (
          <View style={styles.stepContent}>
            {servicesLoading ? (
              <ActivityIndicator color={Colors.gold} style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.cardList}>
                {services.map((s) => (
                  <ServiceCard
                    key={s.id}
                    service={s}
                    selected={selectedService?.id === s.id}
                    onSelect={(sv) => { setSelectedService(sv); }}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* ─── Step: Barber ──────────────────────────────── */}
        {step === 'barber' && (
          <View style={styles.stepContent}>
            {barbersLoading ? (
              <ActivityIndicator color={Colors.gold} style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.cardList}>
                {barbers.map((b) => (
                  <BarberCard
                    key={b.id}
                    barber={b}
                    selected={selectedBarber?.id === b.id}
                    onSelect={setSelectedBarber}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* ─── Step: Date & Time ─────────────────────────── */}
        {step === 'datetime' && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionLabel}>Choisissez une date</Text>
            <DatePicker selected={selectedDate} onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }} />

            <Divider spacing={Spacing.lg} />

            {selectedDate ? (
              <>
                <Text style={styles.sectionLabel}>Créneaux disponibles</Text>
                {slotsLoading ? (
                  <ActivityIndicator color={Colors.gold} />
                ) : slotsError ? (
                  <Text style={styles.errorText}>{slotsError}</Text>
                ) : (
                  <TimeSlotPicker
                    slots={availableSlots}
                    selected={selectedSlot?.start_time ?? null}
                    onSelect={handleSelectSlot}
                  />
                )}
              </>
            ) : (
              <Text style={styles.hintText}>Sélectionnez une date pour voir les créneaux</Text>
            )}
          </View>
        )}

        {/* ─── Step: Confirm ─────────────────────────────── */}
        {step === 'confirm' && selectedService && selectedBarber && selectedDate && selectedSlot && (
          <View style={styles.stepContent}>
            <Card padded elevated>
              <Text style={styles.summaryTitle}>Récapitulatif</Text>
              <Divider spacing={Spacing.md} />

              <View style={styles.summaryRows}>
                <SummaryRow icon="✂️" label="Service" value={selectedService.name} />
                <SummaryRow icon="💰" label="Prix" value={`${parseFloat(selectedService.price).toFixed(2)}€`} />
                <SummaryRow icon="⏱" label="Durée" value={`${selectedService.duration} min`} />
                <Divider spacing={Spacing.md} />
                <SummaryRow icon="💈" label="Barbier" value={selectedBarber.full_name} />
                <SummaryRow
                  icon="📅"
                  label="Date"
                  value={new Date(selectedDate).toLocaleDateString('fr-BE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                />
                <SummaryRow icon="🕐" label="Heure" value={selectedSlot.start_time.substring(0, 5)} />
              </View>
            </Card>

            <View style={styles.depositInfo}>
              <Text style={styles.depositIcon}>💳</Text>
              <View style={styles.depositText}>
                <Text style={styles.depositTitle}>Acompte requis</Text>
                <Text style={styles.depositSub}>
                  Un acompte de 10€ sera demandé pour confirmer votre réservation.
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Navigation buttons */}
      <View style={styles.footer}>
        {step !== 'service' && (
          <Button
            label="← Retour"
            variant="secondary"
            onPress={goBack}
            fullWidth={false}
            style={{ flex: 1 } as never}
          />
        )}

        {step !== 'confirm' ? (
          <Button
            label="Suivant →"
            onPress={goNext}
            disabled={
              (step === 'service' && !selectedService) ||
              (step === 'barber' && !selectedBarber) ||
              (step === 'datetime' && (!selectedDate || !selectedSlot))
            }
            fullWidth={step === 'service'}
            style={{ flex: step !== 'service' ? 1 : undefined } as never}
          />
        ) : (
          <Button
            label="Confirmer la réservation"
            onPress={handleConfirm}
            loading={submitting}
            style={{ flex: 1 } as never}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={summaryStyles.row}>
      <Text style={summaryStyles.icon}>{icon}</Text>
      <Text style={summaryStyles.label}>{label}</Text>
      <Text style={summaryStyles.value}>{value}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  icon: { fontSize: 16, width: 24 },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  value: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium, textAlign: 'right', flex: 1 },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.base, color: Colors.textSecondary, marginTop: 2 },
  content: { padding: Spacing.xl, flexGrow: 1 },
  stepContent: { gap: Spacing.lg },
  cardList: { gap: Spacing.sm },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error, textAlign: 'center' },
  hintText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', padding: Spacing.xl },
  summaryTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  summaryRows: { gap: 2 },
  depositInfo: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.infoSubtle,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.info,
    padding: Spacing.md,
  },
  depositIcon: { fontSize: 22 },
  depositText: { flex: 1 },
  depositTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  depositSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
  },
});
