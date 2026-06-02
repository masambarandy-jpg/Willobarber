import React, { useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useBarbers } from '@/hooks/useBarbers';
import { reservationsApi } from '@/services/api';
import { SERVICES } from '@/components/home/ServiceCarousel';

const { width: SCREEN_W } = Dimensions.get('window');
const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const STEP_LABELS = ['Prestation', 'Barbier', 'Date & heure', 'Paiement'];

// Maps static service string id → backend numeric id
const API_ID_MAP: Record<string, number> = {
  signature:  1,
  barbe:      2,
  rituel:     3,
  express:    4,
  camouflage: 5,
  soin:       6,
};

// Static display data for the 3 house barbers
const BARBER_DATA: Record<string, {
  initial: string;
  title: string;
  rating: number;
  reviews: number;
  avatarColor: string;
  avatarBg: string;
}> = {
  willo: {
    initial: 'W',
    title: 'FONDATEUR & MASTER BARBER',
    rating: 4.9, reviews: 312,
    avatarColor: '#C9A84C', avatarBg: 'rgba(201,168,76,0.15)',
  },
  malik: {
    initial: 'M',
    title: 'BARBIER SENIOR',
    rating: 4.9, reviews: 184,
    avatarColor: '#A0673A', avatarBg: 'rgba(160,103,58,0.15)',
  },
  idris: {
    initial: 'I',
    title: 'BARBIER & COLORISTE',
    rating: 4.8, reviews: 96,
    avatarColor: '#4CAF8A', avatarBg: 'rgba(76,175,138,0.15)',
  },
};

const STATIC_BARBER_NAMES: Record<string, string> = { willo: 'Willo', malik: 'Malik', idris: 'Idris' };

// ── Static time slots (no API) ────────────────────────────────────────────────
const STATIC_SLOTS: Record<string, { time: string; available: boolean }[]> = {
  'MATINÉE': [
    { time: '11:00', available: true },
    { time: '12:00', available: false },
  ],
  'APRÈS-MIDI': [
    { time: '13:00', available: true },
    { time: '14:00', available: true },
    { time: '15:00', available: false },
    { time: '16:00', available: true },
  ],
  'SOIRÉE': [
    { time: '18:00', available: true },
    { time: '19:00', available: true },
    { time: '20:00', available: false },
  ],
};

const STATIC_BARBERS_ORDER = ['willo', 'malik', 'idris'] as const;

const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const DAYS_FR   = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

function formatDateFr(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function Kicker({ children, center }: { children: string; center?: boolean }) {
  return <Text style={[styles.kicker, center && { textAlign: 'center' }]}>{children}</Text>;
}

function GoldItalic({ children }: { children: React.ReactNode }) {
  return <Text style={styles.goldItalic}>{children}</Text>;
}

function BtnPrimary({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <TouchableOpacity style={[styles.btnPrimary, (disabled || loading) && styles.btnDisabled]} onPress={onPress} disabled={disabled || loading} activeOpacity={0.85}>
      {loading
        ? <ActivityIndicator color="#1A1208" size="small" />
        : <Text style={styles.btnPrimaryText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function BtnOutline({ label, onPress, icon }: { label: string; onPress: () => void; icon?: string }) {
  return (
    <TouchableOpacity style={styles.btnOutline} onPress={onPress} activeOpacity={0.85}>
      {icon && <Text style={styles.btnOutlineIcon}>{icon}</Text>}
      <Text style={styles.btnOutlineText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────
function Stepper({ current }: { current: number }) {
  return (
    <View style={styles.stepperRow}>
      {STEP_LABELS.map((lbl, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <React.Fragment key={n}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, active && styles.stepCircleActive, done && styles.stepCircleDone]}>
                <Text style={[styles.stepNum, active && styles.stepNumActive, done && styles.stepNumDone]}>
                  {done ? '✓' : n}
                </Text>
              </View>
              <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{lbl}</Text>
            </View>
            {n < 4 && <View style={[styles.stepConnector, done && styles.stepConnectorDone]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ── BookShell ─────────────────────────────────────────────────────────────────
function BookShell({ step, children, footer }: { step: number; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <View style={styles.bookHeader}>
        <View style={styles.bookHeaderLeft}>
          <Text style={styles.logoMark}>{'{w}'}</Text>
          <Text style={styles.logoBrand}>willobarber</Text>
        </View>
        <View style={styles.secureBadge}>
          <Text style={styles.secureBadgeText}>🔒 3D Secure</Text>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <Kicker>— RÉSERVATION</Kicker>
        <Text style={styles.bookTitle}>Réservez votre <GoldItalic>rituel.</GoldItalic></Text>
        <Text style={styles.bookSub}>Quatre étapes, deux minutes. Vous choisissez, nous nous occupons du reste.</Text>
        <Stepper current={step} />
        <View style={styles.separator} />
        {children}
      </ScrollView>

      {footer}
    </View>
  );
}

function BookFooter({ onBack, onNext, nextLabel = 'Continuer', loading }: { onBack: () => void; onNext: () => void; nextLabel?: string; loading?: boolean }) {
  return (
    <View style={styles.footer}>
      <BtnOutline label="Retour" onPress={onBack} icon="←" />
      <View style={{ flex: 1 }}>
        <BtnPrimary label={nextLabel} onPress={onNext} loading={loading} />
      </View>
    </View>
  );
}

// ── Step 1: Service (statique, 6 prestations en dur) ─────────────────────────
function Step1({ booking, setBooking, onBack, onNext }: any) {
  return (
    <BookShell step={1} footer={<BookFooter onBack={onBack} onNext={onNext} />}>
      <Text style={styles.stepTitle}>Choisissez votre prestation</Text>
      <Text style={styles.stepSub}>Sélectionnez l'une de nos six prestations signature.</Text>

      {SERVICES.map((s) => {
        const on = booking.serviceId === s.id;
        return (
          <Pressable
            key={s.id}
            onPress={() => setBooking({ ...booking, serviceId: s.id })}
            style={[styles.selectCard, on && styles.selectCardActive]}
          >
            <View style={styles.selectCardTop}>
              <View style={styles.cardTopLeft}>
                <Text style={styles.cardCat}>{s.cat}</Text>
                {s.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>POPULAIRE</Text>
                  </View>
                )}
              </View>
              <View style={[styles.radioCircle, on && styles.radioCircleActive]}>
                {on && <Text style={styles.radioCheck}>✓</Text>}
              </View>
            </View>
            <Text style={styles.cardName}>{s.name}</Text>
            <Text style={styles.cardDesc}>{s.short}</Text>
            <View style={styles.cardMeta}>
              <Text style={styles.cardDur}>⏱ {s.dur}</Text>
              <Text style={styles.cardPrice}>{s.price} €</Text>
            </View>
          </Pressable>
        );
      })}
    </BookShell>
  );
}

// ── Step 2: Barber ────────────────────────────────────────────────────────────
function Step2({ booking, setBooking, onBack, onNext }: any) {
  return (
    <BookShell step={2} footer={<BookFooter onBack={onBack} onNext={onNext} />}>
      <Text style={styles.stepTitle}>Votre barbier</Text>
      <Text style={styles.stepSub}>Trois experts, un style unique.</Text>

      {/* Willo · Malik · Idris */}
      {STATIC_BARBERS_ORDER.map(key => {
        const data = BARBER_DATA[key];
        const name = STATIC_BARBER_NAMES[key];
        const on = booking.barberId === key;
        return (
          <Pressable
            key={key}
            onPress={() => setBooking({ ...booking, barberId: key })}
            style={[styles.barberCard, on && styles.barberCardActive]}
          >
            <View style={[styles.barberAvatarLg, {
              backgroundColor: data.avatarBg,
              borderColor: on ? data.avatarColor : `${data.avatarColor}55`,
            }]}>
              <Text style={[styles.barberInitial, { color: data.avatarColor }]}>
                {data.initial}
              </Text>
            </View>
            <View style={styles.barberInfo}>
              <View style={styles.barberTopRow}>
                <Text style={styles.barberFullName}>{name}</Text>
                <View style={[styles.radioCircle, on && styles.radioCircleActive]}>
                  {on && <Text style={styles.radioCheck}>✓</Text>}
                </View>
              </View>
              <Text style={[styles.barberTitleText, { color: data.avatarColor }]}>
                {data.title}
              </Text>
              <View style={styles.barberRatingRow}>
                <Text style={styles.barberStars}>★</Text>
                <Text style={styles.barberRatingNum}> {data.rating.toFixed(1)}</Text>
                <Text style={styles.barberReviews}> · {data.reviews} avis</Text>
              </View>
            </View>
          </Pressable>
        );
      })}

      {/* Peu importe */}
      <Pressable
        onPress={() => setBooking({ ...booking, barberId: 'any' })}
        style={[styles.barberCardAny, booking.barberId === 'any' && styles.barberCardAnyActive]}
      >
        <Text style={styles.barberAnyIcon}>👥</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.barberAnyName, booking.barberId === 'any' && { color: '#fff' }]}>
            Peu importe — premier disponible
          </Text>
          <Text style={styles.barberAnyDesc}>Plus de créneaux · même qualité garantie</Text>
        </View>
        {booking.barberId === 'any' && (
          <Text style={styles.barberAnyCheck}>✓</Text>
        )}
      </Pressable>
    </BookShell>
  );
}

// ── Custom Calendar (pure React Native) ──────────────────────────────────────
const MONTHS_CAP = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAY_HEADERS = ['LUN','MAR','MER','JEU','VEN','SAM','DIM'];

function CustomCalendar({ selectedDate, onSelectDate, minDate, maxDate }: {
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  minDate: string;
  maxDate: string;
}) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const pad = (n: number) => String(n).padStart(2, '0');
  const toDateStr = (d: number) => `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayJS = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset = (firstDayJS + 6) % 7; // Mon-first

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonthStr = viewMonth === 0
    ? `${viewYear - 1}-12-01`
    : `${viewYear}-${pad(viewMonth)}-01`;
  const nextMonthStr = viewMonth === 11
    ? `${viewYear + 1}-01-01`
    : `${viewYear}-${pad(viewMonth + 2)}-01`;

  const canGoPrev = prevMonthStr >= minDate.slice(0, 7) + '-01' || minDate.slice(0, 7) === prevMonthStr.slice(0, 7);
  const canGoNext = nextMonthStr.slice(0, 7) <= maxDate.slice(0, 7);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const rows = Math.ceil(cells.length / 7);

  return (
    <View style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <TouchableOpacity onPress={prevMonth} disabled={!canGoPrev} style={{ padding: 8 }}>
          <Text style={{ fontSize: 22, color: canGoPrev ? '#C9A84C' : 'rgba(255,255,255,0.15)', fontWeight: '300', lineHeight: 24 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontFamily: SERIF, fontSize: 17, fontWeight: '600', color: '#fff' }}>
          {MONTHS_CAP[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity onPress={nextMonth} disabled={!canGoNext} style={{ padding: 8 }}>
          <Text style={{ fontSize: 22, color: canGoNext ? '#C9A84C' : 'rgba(255,255,255,0.15)', fontWeight: '300', lineHeight: 24 }}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
        {DAY_HEADERS.map(h => (
          <View key={h} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 }}>{h}</Text>
          </View>
        ))}
      </View>

      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row', marginBottom: 2 }}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={{ flex: 1 }} />;
            const dateStr = toDateStr(day);
            const isMonday = col === 0;
            const isDisabled = isMonday || dateStr < minDate || dateStr > maxDate;
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === todayStr;
            return (
              <TouchableOpacity
                key={col}
                onPress={() => !isDisabled && onSelectDate(dateStr)}
                disabled={isDisabled}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 5 }}
              >
                <View style={[
                  { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
                  isSelected && { backgroundColor: '#C9A84C' },
                  isToday && !isSelected && { borderWidth: 1, borderColor: '#C9A84C' },
                ]}>
                  <Text style={[
                    { fontSize: 14, fontWeight: '500', color: '#fff' },
                    isDisabled && { color: 'rgba(255,255,255,0.2)' },
                    isSelected && { color: '#1A1208', fontWeight: '700' },
                    isToday && !isSelected && !isDisabled && { color: '#C9A84C' },
                  ]}>
                    {day}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Step 3: Date & heure ──────────────────────────────────────────────────────
function Step3({ booking, setBooking, onBack, onNext }: any) {
  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  return (
    <BookShell step={3} footer={<BookFooter onBack={onBack} onNext={onNext} nextLabel="Aller au paiement" />}>
      <Text style={styles.stepTitle}>Date & heure</Text>
      <Text style={styles.stepSub}>Choisissez le jour, puis le créneau qui vous arrange.</Text>

      {/* Calendar card */}
      <View style={styles.calendarCard}>
        <CustomCalendar
          selectedDate={booking.date}
          onSelectDate={(dateStr) => setBooking({ ...booking, date: dateStr, time: null })}
          minDate={today}
          maxDate={maxDate}
        />
      </View>

      {/* Hours banner */}
      <View style={styles.hoursBanner}>
        <Text style={styles.hoursBannerText}>⏰  Ouvert du mardi au dimanche, 11h – 20h. Fermé le lundi.</Text>
      </View>

      {/* Slots section */}
      {!booking.date ? (
        <View style={styles.noDatePlaceholder}>
          <Text style={styles.noDateIcon}>📅</Text>
          <Text style={styles.noDateText}>Sélectionnez une date pour voir les créneaux disponibles.</Text>
        </View>
      ) : (
        <View>
          <View style={styles.slotsTitleRow}>
            <Text style={styles.slotsTitle}>Créneaux disponibles</Text>
            <Text style={styles.slotsDateLabel}>{formatDateFr(booking.date)}</Text>
          </View>

          {(Object.entries(STATIC_SLOTS) as [string, { time: string; available: boolean }[]][]).map(([period, slots]) => (
            <View key={period} style={styles.slotPeriodBlock}>
              <View style={styles.slotPeriodHeader}>
                <View style={styles.slotPeriodDot} />
                <Text style={styles.slotPeriodLabel}>{period}</Text>
                <View style={styles.slotPeriodLine} />
              </View>
              <View style={styles.slotsGrid}>
                {slots.map(({ time, available }) => {
                  const on = booking.time === time;
                  return (
                    <Pressable
                      key={time}
                      onPress={() => available && setBooking({ ...booking, time })}
                      disabled={!available}
                      style={[
                        styles.slotBtn,
                        on && styles.slotBtnActive,
                        !available && styles.slotBtnUnavailable,
                      ]}
                    >
                      <Text style={[
                        styles.slotText,
                        on && styles.slotTextActive,
                        !available && styles.slotTextUnavailable,
                      ]}>
                        {time}
                      </Text>
                      {!available && (
                        <Text style={styles.slotComplet}>Complet</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </BookShell>
  );
}

// ── Step 4: Confirmation ──────────────────────────────────────────────────────
function Step4({ booking, total, onBack, onConfirm, loading }: any) {
  const [notes, setNotes] = useState('');
  return (
    <BookShell step={4} footer={<BookFooter onBack={onBack} onNext={() => onConfirm(notes)} nextLabel={`Confirmer (10 € d'acompte)`} loading={loading} />}>
      <Text style={styles.stepTitle}>Acompte & paiement</Text>
      <Text style={styles.stepSub}>Un acompte de 10 € sécurise votre créneau. Le solde se règle au salon.</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Récapitulatif</Text>
        <View style={styles.summaryRow}><Text style={styles.summaryKey}>Prestation</Text><Text style={styles.summaryVal}>{booking.serviceName || '—'}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryKey}>Barbier</Text><Text style={styles.summaryVal}>{booking.barberName || 'Premier disponible'}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryKey}>Date</Text><Text style={styles.summaryVal}>{booking.date || '—'}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryKey}>Heure</Text><Text style={styles.summaryVal}>{booking.time || '—'}</Text></View>
        <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: 8, paddingTop: 12 }]}>
          <Text style={styles.summaryKey}>Total</Text>
          <Text style={[styles.summaryVal, { fontFamily: SERIF, fontSize: 22, color: '#C9A84C' }]}>{total} €</Text>
        </View>
      </View>

      <View style={styles.notesWrap}>
        <Text style={styles.fieldLabel}>Notes (optionnel)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Demandes particulières, allergies…"
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.paymentInfo}>
        <Text style={styles.paymentInfoText}>💳  10 € d'acompte sécurisé requis · Solde au salon</Text>
        <Text style={[styles.paymentInfoText, { marginTop: 4 }]}>🔒  Paiement 3D Secure · Annulation gratuite -24h</Text>
      </View>
    </BookShell>
  );
}

// ── Confirmation screen ───────────────────────────────────────────────────────
function ConfirmationView({ booking, total, onReset }: any) {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 16, paddingBottom: 40 }}>
        <View style={styles.confirmHalo}>
          <View style={styles.confirmCheck}>
            <Text style={{ fontSize: 38, color: '#fff' }}>✓</Text>
          </View>
          <Kicker center>— CONFIRMATION</Kicker>
          <Text style={[styles.bookTitle, { textAlign: 'center', marginTop: 10 }]}>
            Votre rendez-vous est <GoldItalic>confirmé.</GoldItalic>
          </Text>
          <Text style={styles.confirmSub}>Un email de confirmation vient d'être envoyé. Rappel SMS la veille.</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Votre rendez-vous</Text>
          <View style={styles.summaryRow}><Text style={styles.summaryKey}>Prestation</Text><Text style={styles.summaryVal}>{booking.serviceName || '—'}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryKey}>Barbier</Text><Text style={styles.summaryVal}>{booking.barberName || 'Premier disponible'}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryKey}>Date</Text><Text style={styles.summaryVal}>{booking.date || '—'}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryKey}>Heure</Text><Text style={styles.summaryVal}>{booking.time || '—'}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryKey}>Adresse</Text><Text style={styles.summaryVal}>Rue Auguste Van Zande 78</Text></View>
        </View>

        <TouchableOpacity style={styles.btnPrimary} onPress={onReset} activeOpacity={0.85}>
          <Text style={styles.btnPrimaryText}>Retour à l'accueil  →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BookScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { barbers } = useBarbers();
  const { serviceId: paramServiceId } = useLocalSearchParams<{ serviceId?: string }>();

  const [step, setStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<{
    serviceId: string | null;
    barberId: string | null;
    date: string | null;
    time: string | null;
    serviceName?: string;
    barberName?: string;
  }>({ serviceId: null, barberId: 'willo', date: null, time: null });

  // Pre-select service when navigating from carousel
  useFocusEffect(
    useCallback(() => {
      if (paramServiceId) {
        setBooking(prev => ({ ...prev, serviceId: paramServiceId }));
        setStep(1);
      }
    }, [paramServiceId])
  );

  const svc = SERVICES.find(s => s.id === booking.serviceId);
  const total = svc ? svc.price : 0;

  const enrichBooking = useCallback(() => {
    const svcName = SERVICES.find(s => s.id === booking.serviceId)?.name;
    const brName = barbers?.find((b: any) => String(b.id) === booking.barberId)?.full_name
      ?? STATIC_BARBER_NAMES[booking.barberId ?? ''];
    return { ...booking, serviceName: svcName, barberName: brName || 'Premier disponible' };
  }, [booking, barbers]);

  const handleNext = () => {
    if (step === 1 && !booking.serviceId) { Alert.alert('Sélectionnez une prestation'); return; }
    if (step === 2 && !booking.barberId) { Alert.alert('Sélectionnez un barbier'); return; }
    if (step === 3 && (!booking.date || !booking.time)) { Alert.alert('Choisissez une date et une heure'); return; }
    if (step < 4) { setStep(step + 1); }
  };

  const handleConfirm = async (notes: string) => {
    if (!booking.serviceId || !booking.date || !booking.time || !user?.id) {
      Alert.alert('Informations manquantes');
      return;
    }
    const apiServiceId = API_ID_MAP[booking.serviceId];
    if (!apiServiceId) {
      Alert.alert('Prestation introuvable');
      return;
    }
    setSubmitting(true);
    try {
      const durStr = svc?.dur ?? '45 min';
      const hPart = durStr.match(/(\d+)h/);
      const mPart = durStr.match(/(\d+)\s*min/);
      const duration = (hPart ? parseInt(hPart[1]) * 60 : 0) + (mPart ? parseInt(mPart[1]) : 0) || 45;
      const [h, m] = (booking.time ?? '10:00').split(':').map(Number);
      const totalMin = h * 60 + m + duration;
      const endTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;

      const payload: Record<string, unknown> = {
        service: apiServiceId,
        date: booking.date,
        start_time: booking.time,
        end_time: endTime,
        notes,
      };
      if (booking.barberId && booking.barberId !== 'any') {
        const apiBarber = barbers?.find((b: any) =>
          (b.full_name ?? '').toLowerCase().startsWith(booking.barberId!)
        );
        const numId = apiBarber ? Number(apiBarber.id) : Number(booking.barberId);
        if (!isNaN(numId)) payload.barber = numId;
      }
      await reservationsApi.create(payload as unknown as Parameters<typeof reservationsApi.create>[0]);
      setBooking(enrichBooking());
      setConfirmed(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string; detail?: string } } })?.response?.data?.error
        ?? (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Erreur lors de la réservation.';
      Alert.alert('Erreur', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setConfirmed(false);
    setBooking({ serviceId: null, barberId: 'willo', date: null, time: null });
  };

  if (confirmed) {
    return <ConfirmationView booking={booking} total={total} onReset={handleReset} />;
  }

  const b = enrichBooking();

  if (step === 1) return <Step1 booking={b} setBooking={setBooking} onBack={() => router.navigate('/(tabs)')} onNext={handleNext} />;
  if (step === 2) return <Step2 booking={b} setBooking={setBooking} onBack={() => setStep(1)} onNext={handleNext} />;
  if (step === 3) return <Step3 booking={b} setBooking={setBooking} onBack={() => setStep(2)} onNext={handleNext} />;
  return <Step4 booking={b} total={total} onBack={() => setStep(3)} onConfirm={handleConfirm} loading={submitting} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0C0A' },

  // Book header
  bookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 52 : 32,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  bookHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMark: { fontFamily: SERIF, fontSize: 20, fontWeight: '700', color: '#C9A84C' },
  logoBrand: { fontFamily: SERIF, fontSize: 17, fontWeight: '600', color: '#fff' },
  secureBadge: {
    borderWidth: 1,
    borderColor: 'rgba(45,106,79,0.5)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  secureBadgeText: { fontSize: 11, color: '#6fc191', fontWeight: '500' },

  body: { flex: 1 },
  bodyContent: { padding: 20, paddingTop: 20, paddingBottom: 16 },

  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    color: '#C9A84C',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  bookTitle: {
    fontFamily: SERIF,
    fontSize: 38,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 44,
    marginBottom: 8,
  },
  goldItalic: {
    color: '#C9A84C',
    fontStyle: 'italic',
    fontFamily: SERIF,
    fontWeight: '500',
  },
  bookSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 19,
    marginBottom: 18,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 18,
  },
  stepTitle: {
    fontFamily: SERIF,
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  stepSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 18 },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase' },

  // Stepper
  stepperRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stepItem: { width: 58, alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  stepCircleActive: { backgroundColor: '#C9A84C', borderColor: '#C9A84C', shadowColor: '#C9A84C', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10 },
  stepCircleDone: { borderColor: '#C9A84C' },
  stepNum: { fontSize: 14, fontFamily: SERIF, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  stepNumActive: { color: '#1A1208' },
  stepNumDone: { color: '#C9A84C', fontSize: 13 },
  stepLabel: { fontSize: 9.5, fontWeight: '500', color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  stepLabelActive: { color: '#fff', fontWeight: '600' },
  stepConnector: { flex: 1, height: 1.5, backgroundColor: 'rgba(255,255,255,0.16)', marginTop: 14 },
  stepConnectorDone: { backgroundColor: '#C9A84C' },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(13,12,10,0.95)',
    paddingBottom: Platform.OS === 'ios' ? 30 : 14,
  },

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
  btnPrimaryText: { color: '#1A1208', fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },
  btnDisabled: { opacity: 0.6 },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  btnOutlineIcon: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  btnOutlineText: { color: 'rgba(255,255,255,0.8)', fontWeight: '500', fontSize: 14.5 },

  // Select cards (Step 1)
  selectCard: {
    backgroundColor: '#1A1814',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  selectCardActive: {
    borderColor: '#C9A84C',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 3,
  },
  selectCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cardCat: { fontSize: 10.5, fontWeight: '600', letterSpacing: 2, color: '#C9A84C', textTransform: 'uppercase' },
  popularBadge: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  popularBadgeText: { fontSize: 9, fontWeight: '700', color: '#C9A84C', letterSpacing: 0.5 },
  cardName: { fontFamily: SERIF, fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 6, lineHeight: 24 },
  cardDesc: { fontSize: 12.5, color: 'rgba(255,255,255,0.55)', lineHeight: 19, marginBottom: 0 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: 12, paddingTop: 12 },
  cardDur: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  cardPrice: { fontFamily: SERIF, fontSize: 20, fontWeight: '700', color: '#C9A84C' },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: { backgroundColor: '#C9A84C', borderColor: '#C9A84C' },
  radioCheck: { fontSize: 13, color: '#1A1208', fontWeight: '700' },

  // Barber cards (Step 2)
  barberCard: {
    backgroundColor: '#1A1814',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  barberCardActive: {
    borderColor: '#C9A84C',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 4,
  },
  barberAvatarLg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  barberInitial: { fontFamily: SERIF, fontSize: 28, fontWeight: '700' },
  barberInfo: { flex: 1, paddingTop: 2 },
  barberTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  barberFullName: {
    fontFamily: SERIF,
    fontSize: 19,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    lineHeight: 24,
  },
  barberTitleText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  barberSpecialty: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
    marginBottom: 7,
  },
  barberRatingRow: { flexDirection: 'row', alignItems: 'center' },
  barberStars: { fontSize: 11, color: '#C9A84C', letterSpacing: 1 },
  barberRatingNum: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  barberReviews: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },

  // "Peu importe" card (Step 2)
  barberCardAny: {
    backgroundColor: '#111009',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.13)',
    borderStyle: 'dashed',
    marginBottom: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  barberCardAnyActive: {
    borderColor: 'rgba(201,168,76,0.55)',
  },
  barberAnyIcon: { fontSize: 22 },
  barberAnyName: {
    fontFamily: SERIF,
    fontSize: 14.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 3,
  },
  barberAnyDesc: { fontSize: 11.5, color: 'rgba(255,255,255,0.28)', lineHeight: 16 },
  barberAnyCheck: { fontSize: 14, color: '#C9A84C', fontWeight: '700' },

  // Legacy avatar (kept for safety, unused)
  barberAvatar: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  barberAvatarText: { fontFamily: SERIF, fontSize: 22, fontWeight: '600' },

  // Calendar card (Step 3)
  calendarCard: {
    backgroundColor: '#1A1814',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: 14,
    paddingBottom: 8,
  },
  calendarWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },

  // Hours banner
  hoursBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },
  hoursBannerText: { fontSize: 12.5, color: '#C9A84C', flex: 1 },

  // Time slots (Step 3)
  slotsTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  slotsTitle: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
  },
  slotsDateLabel: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'capitalize',
  },
  slotPeriodBlock: { marginBottom: 18 },
  slotPeriodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  slotPeriodDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#C9A84C',
  },
  slotPeriodLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#C9A84C',
    textTransform: 'uppercase',
  },
  slotPeriodLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.15)',
  },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotBtn: {
    width: (SCREEN_W - 40 - 16) / 3,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#1A1814',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    gap: 2,
  },
  slotBtnActive: {
    backgroundColor: '#C9A84C',
    borderColor: '#C9A84C',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 4,
  },
  slotBtnUnavailable: {
    backgroundColor: 'rgba(26,24,20,0.6)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  slotText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  slotTextActive: { color: '#1A1208', fontWeight: '700' },
  slotTextUnavailable: { color: 'rgba(255,255,255,0.2)', fontWeight: '400' },
  slotComplet: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.2)',
    textTransform: 'uppercase',
  },
  noDatePlaceholder: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  noDateIcon: { fontSize: 32 },
  noDateText: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
  },

  // Step 4 summary
  summaryCard: {
    backgroundColor: '#1A1814',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  summaryTitle: { fontFamily: SERIF, fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  summaryKey: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  summaryVal: { fontSize: 13.5, fontWeight: '500', color: '#fff' },

  // Notes
  notesWrap: { marginBottom: 16 },
  notesInput: {
    backgroundColor: '#1A1814',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  paymentInfo: {
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  paymentInfoText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 20 },

  // Confirmation
  confirmHalo: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 52 : 32,
    paddingHorizontal: 22,
    paddingBottom: 26,
    backgroundColor: '#0D0C0A',
  },
  confirmCheck: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  confirmSub: { fontSize: 13.5, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 20, marginTop: 10, maxWidth: 300 },
});
