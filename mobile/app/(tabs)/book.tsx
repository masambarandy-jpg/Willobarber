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

// ── Step 4: Acompte & paiement ────────────────────────────────────────────────
function Step4({ booking, total, user, onBack, onConfirm, loading }: any) {
  const [payMethod, setPayMethod] = useState<'card' | 'apple' | 'google'>('card');
  const [depositAmt, setDepositAmt] = useState<10 | 20>(10);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [cardNum, setCardNum] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [notes, setNotes] = useState('');

  const rawDigits = cardNum.replace(/\D/g, '');
  const paddedNum = rawDigits + '•'.repeat(Math.max(0, 16 - rawDigits.length));
  const formattedNum = [paddedNum.slice(0,4), paddedNum.slice(4,8), paddedNum.slice(8,12), paddedNum.slice(12,16)].join('  ');
  const holderName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim().toUpperCase() : '';

  const handleCardExp = (v: string) => {
    const d = v.replace(/\D/g, '');
    setCardExp(d.length > 2 ? `${d.slice(0,2)}/${d.slice(2,4)}` : d);
  };

  return (
    <BookShell
      step={4}
      footer={
        <BookFooter
          onBack={onBack}
          onNext={() => onConfirm(notes, depositAmt)}
          nextLabel={`Payer ${depositAmt} € et réserver  →`}
          loading={loading}
        />
      }
    >
      <Text style={styles.stepTitle}>Acompte & paiement</Text>
      <Text style={styles.stepSub}>Sécurisez votre créneau avec un acompte. Le solde se règle au salon.</Text>

      {/* Summary banner */}
      <Pressable onPress={() => setSummaryOpen(o => !o)} style={styles.summaryBanner}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14 }}>📋</Text>
          <Text style={styles.summaryBannerLabel}>Voir le récapitulatif</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.summaryBannerPrice}>{total} €</Text>
          <Text style={styles.summaryBannerChev}>{summaryOpen ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {summaryOpen && (
        <View style={styles.summaryDropdown}>
          <View style={styles.summaryRow}><Text style={styles.summaryKey}>Prestation</Text><Text style={styles.summaryVal}>{booking.serviceName || '—'}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryKey}>Barbier</Text><Text style={styles.summaryVal}>{booking.barberName || 'Premier disponible'}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryKey}>Date</Text><Text style={styles.summaryVal}>{booking.date || '—'}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryKey}>Heure</Text><Text style={styles.summaryVal}>{booking.time || '—'}</Text></View>
        </View>
      )}

      {/* Contact */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Informations de contact</Text>
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Prénom</Text>
            <View style={styles.fieldRO}><Text style={styles.fieldROText}>{user?.first_name || '—'}</Text></View>
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Nom</Text>
            <View style={styles.fieldRO}><Text style={styles.fieldROText}>{user?.last_name || '—'}</Text></View>
          </View>
        </View>
        <View style={{ marginTop: 10 }}>
          <Text style={styles.fieldLabel}>Email</Text>
          <View style={styles.fieldRO}><Text style={styles.fieldROText}>{user?.email || '—'}</Text></View>
        </View>
        <View style={{ marginTop: 10 }}>
          <Text style={styles.fieldLabel}>Téléphone</Text>
          <View style={styles.fieldRO}><Text style={styles.fieldROText}>{user?.phone || 'Non renseigné'}</Text></View>
        </View>
      </View>

      {/* Payment method */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Méthode de paiement</Text>

        <View style={styles.payTabs}>
          {([
            { id: 'card', label: '💳  Carte' },
            { id: 'apple', label: '  Apple Pay' },
            { id: 'google', label: '  Google Pay' },
          ] as { id: 'card'|'apple'|'google'; label: string }[]).map(m => (
            <Pressable key={m.id} onPress={() => setPayMethod(m.id)} style={[styles.payTab, payMethod === m.id && styles.payTabOn]}>
              <Text style={[styles.payTabTxt, payMethod === m.id && styles.payTabTxtOn]}>{m.label}</Text>
            </Pressable>
          ))}
        </View>

        {payMethod === 'card' ? (
          <>
            {/* Visual card */}
            <View style={styles.visualCard}>
              <View style={styles.vcCircle1} />
              <View style={styles.vcCircle2} />
              <View style={styles.vcTop}>
                <Text style={styles.vcBrand}>WILLOBARBER</Text>
                <View style={styles.vcChip} />
              </View>
              <Text style={styles.vcNumber}>{formattedNum}</Text>
              <View style={styles.vcBottom}>
                <View>
                  <Text style={styles.vcMeta}>TITULAIRE</Text>
                  <Text style={styles.vcValue}>{holderName || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.vcMeta}>EXPIRE</Text>
                  <Text style={styles.vcValue}>{cardExp || '••/••'}</Text>
                </View>
              </View>
            </View>

            {/* Card fields */}
            <View style={{ gap: 10 }}>
              <View>
                <Text style={styles.fieldLabel}>Numéro de carte</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={rawDigits.replace(/(.{4})/g, '$1 ').trim()}
                  onChangeText={v => setCardNum(v.replace(/\D/g, '').slice(0, 16))}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Expiration</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={cardExp}
                    onChangeText={handleCardExp}
                    placeholder="MM/AA"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>CVC</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={cardCvc}
                    onChangeText={v => setCardCvc(v.replace(/\D/g, '').slice(0, 3))}
                    placeholder="•••"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="numeric"
                    maxLength={3}
                    secureTextEntry
                  />
                </View>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.altPayBox}>
            <Text style={{ fontSize: 32 }}>{payMethod === 'apple' ? '🍎' : '🔵'}</Text>
            <Text style={styles.altPayTxt}>
              {payMethod === 'apple'
                ? 'Authentification via Touch ID ou Face ID'
                : 'Authentification via votre compte Google'}
            </Text>
          </View>
        )}
      </View>

      {/* Amount options */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Montant à régler maintenant</Text>
        {([
          { amt: 10 as const, badge: 'OBLIGATOIRE', desc: 'Montant minimum pour confirmer la réservation', req: true },
          { amt: 20 as const, badge: 'OPTIONNEL',   desc: 'Déduit du total lors de votre passage au salon', req: false },
        ]).map(({ amt, badge, desc, req }) => (
          <Pressable
            key={amt}
            onPress={() => setDepositAmt(amt)}
            style={[styles.amtOption, depositAmt === amt && styles.amtOptionOn]}
          >
            <View style={[styles.radioCircle, depositAmt === amt && styles.radioCircleActive]}>
              {depositAmt === amt && <Text style={styles.radioCheck}>✓</Text>}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.amtValue, depositAmt === amt && { color: '#C9A84C' }]}>{amt} €</Text>
                <View style={[styles.amtBadge, req && styles.amtBadgeReq]}>
                  <Text style={[styles.amtBadgeTxt, req && styles.amtBadgeTxtReq]}>{badge}</Text>
                </View>
              </View>
              <Text style={styles.amtDesc}>{desc}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Notes */}
      <View style={styles.notesWrap}>
        <Text style={styles.fieldLabel}>Notes pour le barbier (optionnel)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Allergies, préférences de coupe…"
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline
          numberOfLines={2}
        />
      </View>

      <View style={styles.securityRow}>
        <Text style={styles.securityTxt}>🔒  Paiement 3D Secure · Annulation gratuite 24h avant</Text>
      </View>
    </BookShell>
  );
}

// ── Confirmation screen ───────────────────────────────────────────────────────
function ConfirmationView({ booking, total, deposit, bookingRef, onReset }: {
  booking: any;
  total: number;
  deposit: number;
  bookingRef: string;
  onReset: () => void;
}) {
  const solde = total - deposit;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.confirmScroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.confirmHeader}>
          <View style={styles.confirmRingOuter}>
            <View style={styles.confirmCheckCircle}>
              <Text style={styles.confirmCheckText}>✓</Text>
            </View>
          </View>
          <Text style={[styles.kicker, { textAlign: 'center', marginTop: 22, letterSpacing: 4 }]}>
            — CONFIRMATION —
          </Text>
          <Text style={styles.confirmTitle}>
            {'Votre rendez-vous est\n'}
            <Text style={styles.goldItalic}>confirmé.</Text>
          </Text>
          <Text style={styles.confirmSubtitle}>
            Un email de confirmation vient de vous être envoyé.{' '}
            Rappel SMS la veille.
          </Text>
        </View>

        {/* ── Card : Numéro de réservation ── */}
        <View style={styles.confirmCard}>
          <Text style={styles.confirmCardKicker}>NUMÉRO DE RÉSERVATION</Text>
          <View style={styles.confirmRefRow}>
            <Text style={styles.confirmRefNum}>{bookingRef}</Text>
            <View style={styles.emailBadge}>
              <Text style={styles.emailBadgeTxt}>✓  Email envoyé</Text>
            </View>
          </View>
        </View>

        {/* ── Card : Votre rendez-vous ── */}
        <View style={styles.confirmCard}>
          <Text style={styles.confirmCardTitle}>Votre rendez-vous</Text>
          <View style={styles.confirmServiceBadgeWrap}>
            <View style={styles.confirmServiceBadge}>
              <Text style={styles.confirmServiceBadgeTxt}>{booking.serviceName || '—'}</Text>
            </View>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmKey}>Barbier</Text>
            <Text style={styles.confirmVal}>{booking.barberName || 'Premier disponible'}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmKey}>Date & heure</Text>
            <Text style={styles.confirmVal}>
              {booking.date ? formatDateFr(booking.date) : '—'}
              {booking.time ? `  ·  ${booking.time}` : ''}
            </Text>
          </View>
          <View style={[styles.confirmRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.confirmKey}>Adresse</Text>
            <Text style={styles.confirmVal}>Rue Auguste Van Zande 78</Text>
          </View>
        </View>

        {/* ── Card : Récapitulatif de paiement ── */}
        <View style={styles.confirmCard}>
          <Text style={styles.confirmCardTitle}>Récapitulatif de paiement</Text>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmKey}>{booking.serviceName || 'Prestation'}</Text>
            <Text style={styles.confirmVal}>{total} €</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmKey}>Acompte payé</Text>
            <Text style={styles.confirmAcompte}>− {deposit} €</Text>
          </View>
          <View style={[styles.confirmRow, styles.confirmSoldeRow]}>
            <Text style={styles.confirmSoldeKey}>Solde au salon</Text>
            <Text style={styles.confirmSoldeVal}>{solde} €</Text>
          </View>
        </View>

        {/* ── CTA ── */}
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
  const [confirmRef, setConfirmRef] = useState('');
  const [paidDeposit, setPaidDeposit] = useState(10);
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

  const handleConfirm = (_notes: string, depositAmt: number) => {
    setBooking(enrichBooking());
    setConfirmRef(`WB-2026-${Math.floor(10000 + Math.random() * 90000)}`);
    setPaidDeposit(depositAmt);
    setConfirmed(true);
  };

  const handleReset = () => {
    setStep(1);
    setConfirmed(false);
    setBooking({ serviceId: null, barberId: 'willo', date: null, time: null });
  };

  if (confirmed) {
    return (
      <ConfirmationView
        booking={booking}
        total={total}
        deposit={paidDeposit}
        bookingRef={confirmRef}
        onReset={handleReset}
      />
    );
  }

  const b = enrichBooking();

  if (step === 1) return <Step1 booking={b} setBooking={setBooking} onBack={() => router.navigate('/(tabs)')} onNext={handleNext} />;
  if (step === 2) return <Step2 booking={b} setBooking={setBooking} onBack={() => setStep(1)} onNext={handleNext} />;
  if (step === 3) return <Step3 booking={b} setBooking={setBooking} onBack={() => setStep(2)} onNext={handleNext} />;
  return <Step4 booking={b} total={total} user={user} onBack={() => setStep(3)} onConfirm={handleConfirm} loading={submitting} />;
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
  confirmScroll: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 52 : 32,
    paddingBottom: 36,
    gap: 14,
  },
  confirmHeader: {
    alignItems: 'center',
    marginBottom: 6,
  },
  confirmRingOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(45,106,79,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCheckCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 10,
  },
  confirmCheckText: {
    fontSize: 34,
    color: '#fff',
    fontWeight: '600',
  },
  confirmTitle: {
    fontFamily: SERIF,
    fontSize: 30,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 38,
    marginTop: 14,
    marginBottom: 10,
  },
  confirmSubtitle: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  confirmCard: {
    backgroundColor: '#1A1814',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  confirmCardKicker: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  confirmRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confirmRefNum: {
    fontFamily: SERIF,
    fontSize: 20,
    fontWeight: '700',
    color: '#C9A84C',
    letterSpacing: 1,
  },
  emailBadge: {
    backgroundColor: 'rgba(45,106,79,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(45,106,79,0.4)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  emailBadgeTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4CAF8A',
  },
  confirmCardTitle: {
    fontFamily: SERIF,
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 14,
  },
  confirmServiceBadgeWrap: {
    marginBottom: 14,
  },
  confirmServiceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(201,168,76,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  confirmServiceBadgeTxt: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#C9A84C',
    letterSpacing: 0.5,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  confirmKey: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
  },
  confirmVal: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  confirmAcompte: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#4CAF8A',
  },
  confirmSoldeRow: {
    borderBottomWidth: 0,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  confirmSoldeKey: {
    fontFamily: SERIF,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  confirmSoldeVal: {
    fontFamily: SERIF,
    fontSize: 20,
    fontWeight: '700',
    color: '#C9A84C',
  },

  // Step 4 redesign
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.22)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 14,
  },
  summaryBannerLabel: { fontSize: 13.5, fontWeight: '500', color: 'rgba(255,255,255,0.75)' },
  summaryBannerPrice: { fontFamily: SERIF, fontSize: 19, fontWeight: '700', color: '#C9A84C' },
  summaryBannerChev: { fontSize: 9, color: 'rgba(255,255,255,0.35)' },
  summaryDropdown: {
    backgroundColor: '#1A1814',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    marginTop: -8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionBlock: {
    backgroundColor: '#1A1814',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: SERIF,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 14,
  },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldHalf: { flex: 1 },
  fieldRO: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  fieldROText: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  fieldInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
  },
  payTabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  payTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  payTabOn: { borderColor: '#C9A84C', backgroundColor: 'rgba(201,168,76,0.1)' },
  payTabTxt: { fontSize: 11.5, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  payTabTxtOn: { color: '#C9A84C', fontWeight: '700' },
  visualCard: {
    width: '100%',
    height: 178,
    backgroundColor: '#1A1208',
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    overflow: 'hidden',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
  },
  vcCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(201,168,76,0.11)',
    top: -70,
    right: -50,
  },
  vcCircle2: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(201,168,76,0.07)',
    bottom: -40,
    left: -30,
  },
  vcTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vcBrand: { fontFamily: SERIF, fontSize: 13, fontWeight: '700', color: '#C9A84C', letterSpacing: 2 },
  vcChip: { width: 30, height: 22, borderRadius: 4, backgroundColor: '#C9A84C', opacity: 0.85 },
  vcNumber: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 3,
    textAlign: 'center',
  },
  vcBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  vcMeta: { fontSize: 8, fontWeight: '700', letterSpacing: 1.5, color: 'rgba(201,168,76,0.55)', marginBottom: 2 },
  vcValue: { fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.5 },
  altPayBox: { alignItems: 'center', paddingVertical: 28, gap: 12 },
  altPayTxt: { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 19 },
  amtOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  amtOptionOn: {
    borderColor: '#C9A84C',
    backgroundColor: 'rgba(201,168,76,0.07)',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  amtValue: { fontFamily: SERIF, fontSize: 20, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  amtBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  amtBadgeReq: { backgroundColor: 'rgba(201,168,76,0.12)', borderColor: 'rgba(201,168,76,0.3)' },
  amtBadgeTxt: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: 'rgba(255,255,255,0.35)' },
  amtBadgeTxtReq: { color: '#C9A84C' },
  amtDesc: { fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 17 },
  securityRow: { alignItems: 'center', paddingVertical: 8, marginBottom: 6 },
  securityTxt: { fontSize: 11.5, color: 'rgba(255,255,255,0.3)', textAlign: 'center' },
});
