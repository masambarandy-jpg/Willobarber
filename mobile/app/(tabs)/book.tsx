import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Fonts } from '@/constants';
import { reservationsApi, servicesApi } from '@/services/api';
import { useIsTablet } from '@/components/client/useIsTablet';
import type { TranslationKey } from '@/i18n/translations';

import { BookingHeader }      from '@/components/booking/BookingHeader';
import { BookingStepper }     from '@/components/booking/BookingStepper';
import { Step1Service }       from '@/components/booking/Step1Service';
import { Step2Barber }        from '@/components/booking/Step2Barber';
import { Step3Date, type Step3DateHandle } from '@/components/booking/Step3Date';
import { Step4Payment, type Step4PaymentHandle } from '@/components/booking/Step4Payment';
import { BookingConfirmation } from '@/components/booking/BookingConfirmation';

import {
  ACOMPTE_FIXE,
  BARBERS,
  fmtPrice,
  formatDateShortFr,
  formatSlot,
  type AmountChoice,
  type BookingState,
  type CardForm,
  type PaymentMethod,
  SERVICES,
  type StaticBarber,
  type StaticService,
} from '@/components/booking/data';

const GOLD = '#C9A84C';

function RecapSidebar({
  step,
  booking,
  totalPrice,
  amountChoice,
}: {
  step: number;
  booking: BookingState;
  totalPrice: number;
  amountChoice: AmountChoice;
}) {
  const { t } = useLanguage();
  const { service, barber, date, time } = booking;
  const rows: { label: string; value: string }[] = [];
  if (service) rows.push({ label: t('book.recap.service'), value: t(`services.svc.${service.id}.name` as TranslationKey) });
  if (barber) rows.push({ label: t('book.recap.barber'), value: barber.name });
  if (date) rows.push({ label: t('book.recap.date'), value: formatDateShortFr(date) });
  if (time) rows.push({ label: t('book.recap.time'), value: formatSlot(time) });

  const amountDue = step === 4
    ? (amountChoice === 'full' ? (service?.price ?? 0) : ACOMPTE_FIXE)
    : null;

  return (
    <View style={recapStyles.card}>
      <Text style={recapStyles.title}>{t('book.recap.title')}</Text>
      {rows.length === 0 ? (
        <Text style={recapStyles.empty}>{t('book.recap.empty')}</Text>
      ) : (
        <View style={recapStyles.rows}>
          {rows.map((r) => (
            <View key={r.label} style={recapStyles.row}>
              <View style={recapStyles.dot} />
              <Text style={recapStyles.rowLabel}>{r.label}</Text>
              <Text style={recapStyles.rowValue}>{r.value}</Text>
            </View>
          ))}
        </View>
      )}
      {totalPrice > 0 && (
        <>
          <View style={recapStyles.sep} />
          <View style={recapStyles.totalRow}>
            <Text style={recapStyles.totalLabel}>{t('book.recap.total')}</Text>
            <Text style={recapStyles.totalValue}>{fmtPrice(totalPrice)}</Text>
          </View>
          {amountDue !== null && (
            <View style={recapStyles.totalRow}>
              <Text style={recapStyles.dueLabel}>{t('book.recap.dueNow')}</Text>
              <Text style={recapStyles.dueValue}>{fmtPrice(amountDue)}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const recapStyles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1814',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  empty: {
    fontSize: 13,
    color: '#6B6560',
    lineHeight: 19,
  },
  rows: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: GOLD },
  rowLabel: { fontSize: 12.5, color: '#6B6560', width: 78, flexShrink: 0 },
  rowValue: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.9)', fontFamily: Fonts.semiBold },
  sep: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totalLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  totalValue: { fontFamily: Fonts.bold, fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  dueLabel: { fontSize: 13, color: GOLD, fontWeight: '600' },
  dueValue: { fontFamily: Fonts.bold, fontSize: 16, fontWeight: '700', color: GOLD },
});

function isCTAEnabled(step: number, booking: BookingState): boolean {
  switch (step) {
    case 1: return booking.service !== null;
    case 2: return booking.barber  !== null;
    case 3: return booking.date !== null && booking.time !== null;
    default: return false;
  }
}

const INITIAL_BOOKING: BookingState = {
  service:    null,
  childCount: 1,
  barber:     null,
  date:       null,
  time:       null,
};

const EMPTY_CARD: CardForm = {
  prenom: '', nom: '', email: '', phone: '',
  cardNumber: '', expiry: '', cvc: '',
};

export default function BookScreen() {
  const router  = useRouter();
  const isTablet = useIsTablet();
  const insets  = useSafeAreaInsets();
  // Hauteur réelle du footer CTA fixe, mesurée au rendu — utilisée par Step4Payment
  // pour caler son paddingBottom exactement dessus et éviter l'espace vide résiduel
  // (ou, à l'inverse, un chevauchement) entre le contenu et le bouton "Payer".
  const [footerHeight, setFooterHeight] = useState(0);
  const {
    serviceId,
    quickbook,
    prestation,
    barbier: barbierParam,
    date: dateParam,
    heure,
  } = useLocalSearchParams<{
    serviceId?: string;
    quickbook?: string;
    prestation?: string;
    prix?: string;
    duree?: string;
    barbier?: string;
    date?: string;
    heure?: string;
  }>();
  const isQuickbook = quickbook === 'true';
  const { isAuthenticated, user } = useAuth();
  const { showLoginModal } = useAuthModal();
  const { t } = useLanguage();
  const CTA_LABELS: Record<number, string> = {
    1: t('book.cta.continue'),
    2: t('book.cta.continue'),
    3: t('book.cta.toPayment'),
  };
  const prefilled = useRef(false);
  // Distingue "on vient d'arriver sur la confirmation" (ne pas reset) de
  // "on revient sur cet onglet après l'avoir quitté" (reset autorisé) —
  // sans ça, useFocusEffect reset confirmed dès le premier affichage.
  const hasSeenConfirmation = useRef(false);
  const [step,          setStep]          = useState(isQuickbook ? 4 : 1);
  const [confirmed,     setConfirmed]     = useState(false);
  // useFocusEffect ci-dessous doit lire la valeur la plus récente de `confirmed`
  // sans que son callback change d'identité (voir commentaire plus bas) — d'où
  // ce ref tenu à jour en parallèle de l'état.
  const confirmedRef = useRef(confirmed);
  const [booking,       setBooking]       = useState<BookingState>(() => {
    if (isQuickbook) {
      const service = SERVICES.find(s => s.name === prestation) ?? null;
      const barber  = BARBERS.find(b => b.name === barbierParam) ?? null;
      let date: Date | null = null;
      if (dateParam === 'Demain') {
        date = new Date();
        date.setDate(date.getDate() + 1);
        date.setHours(0, 0, 0, 0);
      }
      return { ...INITIAL_BOOKING, service, barber, date, time: heure ?? null };
    }
    const preselected = SERVICES.find(s => s.id === serviceId);
    return preselected ? { ...INITIAL_BOOKING, service: preselected } : INITIAL_BOOKING;
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [cardForm,      setCardForm]      = useState<CardForm>(EMPTY_CARD);
  const [amountChoice,  setAmountChoice]  = useState<AmountChoice>('deposit');
  const [serviceIdMap,  setServiceIdMap]  = useState<Record<string, number>>({});
  const [isPaying,      setIsPaying]      = useState(false);
  const [createdReservationId, setCreatedReservationId] = useState<number | null>(null);
  const step4Ref = useRef<Step4PaymentHandle>(null);
  const step3Ref = useRef<Step3DateHandle>(null);

  // Map slugs statiques → vrais IDs Django (/api/services/)
  useEffect(() => {
    servicesApi.list().then(services => {
      const map: Record<string, number> = {};
      services.forEach((s: any) => {
        const name = s.name.toLowerCase();
        if (name.includes('signature')) map['signature'] = s.id;
        if (name.includes('taille')) map['barbe'] = s.id;
        if (name.includes('rituel')) map['rituel'] = s.id;
        if (name.includes('express')) map['express'] = s.id;
        if (name.includes('camouflage')) map['camouflage'] = s.id;
        if (name.includes('soin')) map['soin'] = s.id;
        if (name.includes('enfant')) map['enfant'] = s.id;
      });
      setServiceIdMap(map);
    }).catch(() => {}); // silencieux si pas connecté
  }, []);

  // Pre-fill contact from authenticated user
  useEffect(() => {
    if (user && !prefilled.current) {
      prefilled.current = true;
      setCardForm({
        prenom:     user.first_name ?? '',
        nom:        user.last_name  ?? '',
        email:      user.email      ?? '',
        phone:      user.phone      ?? '',
        cardNumber: '',
        expiry:     '',
        cvc:        '',
      });
    }
  }, [user]);

  const handleBack = () => {
    if (step === 1) router.replace('/(tabs)');
    else setStep(s => s - 1);
  };

  const handleNext = async () => {
    if (step === 1 && !isAuthenticated) {
      showLoginModal(() => setStep(2), t('book.loginPrompt'));
      return;
    }
    if (step < 4) {
      setStep(s => s + 1);
      return;
    }

    let paymentIntentId: string | undefined;
    if (paymentMethod === 'card') {
      setIsPaying(true);
      try {
        paymentIntentId = await step4Ref.current?.pay();
      } catch (e: any) {
        setIsPaying(false);
        const message = e?.message || t('step4.cardIncomplete');
        if (Platform.OS === 'web') {
          window.alert(message);
        } else {
          Alert.alert(t('step4.paymentErrorTitle'), message);
        }
        return;
      }
      setIsPaying(false);
    }

    if (isAuthenticated && booking.date && booking.time) {
      try {
        const d = booking.date;
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const servicePrice = booking.service?.price ?? 0;
        const amountPaid = amountChoice === 'full' ? servicePrice : ACOMPTE_FIXE;
        const created = await reservationsApi.create({
          service: serviceIdMap[booking.service?.id ?? ''] || 1,
          date: dateStr,
          time: booking.time,
          notes: `Barbier: ${booking.barber?.name || 'Willo'}`,
          payment_intent_id: paymentIntentId,
          amount_paid: amountPaid,
        });
        setCreatedReservationId(created.id);
        console.log('[BOOKING] Nouvelle réservation créée, id:', created.id);
      } catch (e: any) {
        console.error('[RESERVATION] Erreur création après paiement Stripe:', e);

        if (e?.response?.status === 409) {
          const message = e.response?.data?.error
            || 'Ce créneau vient d\'être pris par quelqu\'un d\'autre. Veuillez choisir un autre horaire.';
          if (Platform.OS === 'web') {
            window.alert(message);
          } else {
            Alert.alert('Créneau indisponible', message);
          }
          setBooking(prev => ({ ...prev, time: null }));
          setStep(3);
          step3Ref.current?.refresh();
          return;
        }

        Alert.alert(
          'Erreur de réservation',
          'Paiement reçu mais erreur lors de la réservation. Contactez WilloBarber.'
        );
        return;
      }
    }
    hasSeenConfirmation.current = false;
    setConfirmed(true);
  };

  const resetBookingState = () => {
    hasSeenConfirmation.current = true;
    setStep(1);
    setConfirmed(false);
    setBooking(INITIAL_BOOKING);
    prefilled.current = false;
    setCardForm(EMPTY_CARD);
    setPaymentMethod('card');
    setAmountChoice('deposit');
    setCreatedReservationId(null);
  };

  const handleReschedule = () => {
    resetBookingState();
  };

  const handleGoHome = () => {
    resetBookingState();
    router.replace('/(tabs)');
  };

  useEffect(() => {
    confirmedRef.current = confirmed;
  }, [confirmed]);

  // Si l'utilisateur quitte l'onglet "Réserver" après avoir vu la confirmation
  // puis y revient depuis le menu, on ne veut pas le laisser bloqué sur cet
  // écran — on réinitialise au retour de focus.
  //
  // Le callback ci-dessous DOIT garder une identité stable (deps: []). Si on
  // y mettait `confirmed` en dépendance, useFocusEffect ré-exécute son effet
  // interne à chaque changement d'identité — pas seulement sur un vrai
  // focus/blur de navigation — et son cleanup (qui met hasSeenConfirmation à
  // true) se déclenche donc immédiatement quand `confirmed` passe à true,
  // juste après le paiement : la confirmation se resetait avant même d'être
  // affichée. En lisant `confirmed` via un ref, le callback reste stable et
  // ce cleanup ne s'exécute plus que lors d'un vrai blur de l'onglet.
  useFocusEffect(
    React.useCallback(() => {
      if (confirmedRef.current && hasSeenConfirmation.current) {
        resetBookingState();
      }

      return () => {
        // On quitte l'onglet : si on y revient plus tard avec confirmed
        // toujours à true, ce sera un vrai retour et le reset sera légitime.
        hasSeenConfirmation.current = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // ── State setters ─────────────────────────────────────────────────────────

  const selectService = (s: StaticService) =>
    setBooking(prev => ({ ...prev, service: s }));

  const changeChildCount = (n: number) =>
    setBooking(prev => ({ ...prev, childCount: n }));

  const selectBarber = (b: StaticBarber) =>
    setBooking(prev => ({ ...prev, barber: b }));

  const selectDate = (d: Date) =>
    setBooking(prev => ({ ...prev, date: d, time: null }));

  const selectTime = (t: string) =>
    setBooking(prev => ({ ...prev, time: t }));

  // ── Confirmation screen ───────────────────────────────────────────────────

  if (confirmed) {
    return (
      <BookingConfirmation
        booking={booking}
        reservationId={createdReservationId}
        amountChoice={amountChoice}
        onGoHome={handleGoHome}
        onReschedule={handleReschedule}
      />
    );
  }

  const ctaEnabled   = isCTAEnabled(step, booking);
  const paddingTop   = insets.top;
  const paddingBottom = insets.bottom + 14;

  const totalPrice = booking.service
    ? booking.service.price * (booking.service.counter ? booking.childCount : 1)
    : 0;

  // ── Wizard ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <View style={isTablet ? styles.tabletShell : styles.mobileShell}>
      <View style={isTablet ? styles.tabletLeftCol : styles.mobileLeftCol}>
      {/* Fixed header */}
      <BookingHeader
        paddingTop={paddingTop}
        booking={booking}
        totalPrice={totalPrice}
      />

      {/* Fixed stepper */}
      <BookingStepper currentStep={step} />

      {/* Scrollable step content */}
      {step === 1 && (
        <Step1Service
          booking={booking}
          onSelect={selectService}
          onChildCountChange={changeChildCount}
        />
      )}
      {step === 2 && (
        <Step2Barber
          booking={booking}
          onSelect={selectBarber}
        />
      )}
      {step === 3 && (
        <Step3Date
          ref={step3Ref}
          booking={booking}
          onDateSelect={selectDate}
          onTimeSelect={selectTime}
          serviceId={serviceIdMap[booking.service?.id ?? ''] ?? null}
        />
      )}
      {step === 4 && (
        <Step4Payment
          ref={step4Ref}
          booking={booking}
          paymentMethod={paymentMethod}
          cardForm={cardForm}
          amountChoice={amountChoice}
          onPaymentMethodChange={setPaymentMethod}
          onCardFormChange={setCardForm}
          onAmountChoiceChange={setAmountChoice}
          footerHeight={footerHeight}
        />
      )}

      {/* Fixed CTA footer — outer container is pointer-transparent so clicks pass through to cards */}
      {step === 4 ? (
        /* Step 4: full-width pay button, no back button.
           KeyboardAvoidingView plutôt qu'un simple View : le footer est
           position:absolute/bottom:0, donc sans lui le clavier (ouvert par
           les champs contact du Step4Payment) recouvre le bouton "Payer" au
           lieu de le pousser au-dessus. */
        <KeyboardAvoidingView
          style={styles.footerContainer}
          pointerEvents="box-none"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={100}
        >
          {/* pointerEvents="box-none" ici aussi : sans lui, ce View (padding +
              fond translucide autour du bouton) intercepte tous les clics dans
              son rectangle, y compris hors du bouton — ce qui rendait les
              boutons radio acompte/total du Step4Payment inatteignables dès
              qu'ils défilaient sous cette bande fixe. */}
          <View
            style={[styles.footerInner, { paddingBottom }]}
            pointerEvents="box-none"
            onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
          >
            <TouchableOpacity
              style={[styles.ctaFull, isPaying && styles.ctaDisabled]}
              onPress={handleNext}
              disabled={isPaying}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaFullText}>
                {isPaying ? t('book.cta.paying') : (() => {
                  const price = booking.service?.price ?? 0;
                  const amt = amountChoice === 'full' ? price : ACOMPTE_FIXE;
                  return `${t('book.cta.payPrefix')} ${fmtPrice(amt)} ${t('book.cta.paySuffix')}`;
                })()}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        /* Steps 1-3: back button + CTA */
        <View style={styles.footerContainer} pointerEvents="box-none">
          <View style={[styles.footerInner, { paddingBottom }]} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              activeOpacity={0.8}
            >
              <Text style={styles.backBtnText}>{t('common.back')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cta, !ctaEnabled && styles.ctaDisabled]}
              onPress={handleNext}
              disabled={!ctaEnabled}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>{CTA_LABELS[step]}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      </View>

      {isTablet && (
        <View style={[styles.tabletRightCol, { paddingTop: paddingTop + 24 }]}>
          <RecapSidebar
            step={step}
            booking={booking}
            totalPrice={totalPrice}
            amountChoice={amountChoice}
          />
        </View>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0C0A',
  },

  mobileShell: { flex: 1 },
  mobileLeftCol: { flex: 1 },

  tabletShell: {
    flex: 1,
    flexDirection: 'row',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  tabletLeftCol: {
    flex: 1.4,
    position: 'relative',
  },
  tabletRightCol: {
    flex: 1,
    paddingHorizontal: 28,
  },

  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  footerInner: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(13,12,10,0.85)',
    zIndex: 10,
  },

  backBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 100,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  backBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },

  cta: {
    flex: 2,
    backgroundColor: GOLD,
    borderRadius: 100,
    paddingVertical: 13,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
      },
      android: { elevation: 5 },
    }),
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: '#1a1208',
    fontWeight: '600',
  },

  // Full-width CTA for step 4
  ctaFull: {
    flex: 1,
    backgroundColor: GOLD,
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
      },
      android: { elevation: 5 },
    }),
  },
  ctaFullText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: '#1a1208',
    fontWeight: '600',
  },
});
