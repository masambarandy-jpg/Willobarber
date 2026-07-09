import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { Fonts } from '@/constants';

import { BookingHeader }      from '@/components/booking/BookingHeader';
import { BookingStepper }     from '@/components/booking/BookingStepper';
import { Step1Service }       from '@/components/booking/Step1Service';
import { Step2Barber }        from '@/components/booking/Step2Barber';
import { Step3Date }          from '@/components/booking/Step3Date';
import { Step4Payment }       from '@/components/booking/Step4Payment';
import { BookingConfirmation } from '@/components/booking/BookingConfirmation';

import {
  calcDeposit,
  fmtPrice,
  type AmountChoice,
  type BookingState,
  type CardForm,
  type PaymentMethod,
  SERVICES,
  type StaticBarber,
  type StaticService,
} from '@/components/booking/data';

const GOLD = '#C9A84C';

const CTA_LABELS: Record<number, string> = {
  1: 'Continuer  →',
  2: 'Continuer  →',
  3: 'Aller au paiement  →',
};

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
  const insets  = useSafeAreaInsets();
  const { serviceId } = useLocalSearchParams<{ serviceId?: string }>();
  const { isAuthenticated, user } = useAuth();
  const { showLoginModal } = useAuthModal();
  const prefilled = useRef(false);
  const [step,          setStep]          = useState(1);
  const [confirmed,     setConfirmed]     = useState(false);
  const [booking,       setBooking]       = useState<BookingState>(() => {
    const preselected = SERVICES.find(s => s.id === serviceId);
    return preselected ? { ...INITIAL_BOOKING, service: preselected } : INITIAL_BOOKING;
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [cardForm,      setCardForm]      = useState<CardForm>(EMPTY_CARD);
  const [amountChoice,  setAmountChoice]  = useState<AmountChoice>('deposit');

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

  const handleNext = () => {
    if (step === 1 && !isAuthenticated) {
      showLoginModal(() => setStep(2), 'Pour réserver, connectez-vous en 10 secondes.');
      return;
    }
    if (step < 4) setStep(s => s + 1);
    else setConfirmed(true);
  };

  const handleReschedule = () => {
    setStep(1);
    setConfirmed(false);
    setBooking(INITIAL_BOOKING);
    prefilled.current = false;
    setCardForm(EMPTY_CARD);
  };

  const handleGoHome = () => {
    setStep(1);
    setConfirmed(false);
    setBooking(INITIAL_BOOKING);
    prefilled.current = false;
    setCardForm(EMPTY_CARD);
    router.replace('/(tabs)');
  };

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
          booking={booking}
          onDateSelect={selectDate}
          onTimeSelect={selectTime}
        />
      )}
      {step === 4 && (
        <Step4Payment
          booking={booking}
          paymentMethod={paymentMethod}
          cardForm={cardForm}
          amountChoice={amountChoice}
          onPaymentMethodChange={setPaymentMethod}
          onCardFormChange={setCardForm}
          onAmountChoiceChange={setAmountChoice}
        />
      )}

      {/* Fixed CTA footer — outer container is pointer-transparent so clicks pass through to cards */}
      {step === 4 ? (
        /* Step 4: full-width pay button, no back button */
        <View style={styles.footerContainer} pointerEvents="box-none">
          <View style={[styles.footerInner, { paddingBottom }]}>
            <TouchableOpacity
              style={styles.ctaFull}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaFullText}>
                {(() => {
                  const price = booking.service?.price ?? 0;
                  const amt = amountChoice === 'full' ? price : calcDeposit(price);
                  return `Payer ${fmtPrice(amt)} et réserver →`;
                })()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Steps 1-3: back button + CTA */
        <View style={styles.footerContainer} pointerEvents="box-none">
          <View style={[styles.footerInner, { paddingBottom }]}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              activeOpacity={0.8}
            >
              <Text style={styles.backBtnText}>← Retour</Text>
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
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0C0A',
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
