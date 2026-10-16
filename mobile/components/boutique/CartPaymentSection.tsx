import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StripeCardField } from '@/components/booking/StripeCardField';
import type { CardInputDetails, StripeCardFieldHandle } from '@/components/booking/StripeCardField.types';
import { formatSavedCard } from '@/components/booking/Step4Payment';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { paymentMethodsApi } from '@/services/api';
import type { SavedPaymentMethod } from '@/types';

const GOLD = '#C9A84C';

export interface CartPaymentHandle {
  // Débite `amount` € (carte enregistrée ou saisie) ; retourne l'id du PaymentIntent réglé.
  pay: (amount: number) => Promise<string>;
}

// Même paiement que l'étape 4 de la réservation (StripeCardField + cartes
// mémorisées chez Stripe), dans le style sombre du panier.
export const CartPaymentSection = forwardRef<CartPaymentHandle>(function CartPaymentSection(_props, ref) {
  const { t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const cardFieldRef = useRef<StripeCardFieldHandle>(null);
  const [cardDetails, setCardDetails] = useState<CardInputDetails>();
  const [savedCards, setSavedCards] = useState<SavedPaymentMethod[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    paymentMethodsApi.list()
      .then((cards) => {
        if (cancelled || !cards.length) return;
        setSavedCards(cards);
        setSelectedCardId(cards[0].id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useImperativeHandle(ref, () => ({
    pay: async (amount: number) => {
      const cardForm = {
        prenom: user?.first_name ?? '',
        nom: user?.last_name ?? '',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        cardNumber: '',
        expiry: '',
        cvc: '',
      };
      if (!cardFieldRef.current) throw new Error(t('step4.cardIncomplete'));
      if (selectedCardId) return cardFieldRef.current.pay(amount, cardForm, selectedCardId);
      if (!cardDetails?.complete) throw new Error(t('step4.cardIncomplete'));
      return cardFieldRef.current.pay(amount, cardForm);
    },
  }));

  return (
    <View style={styles.card} testID="cart-payment">
      <Text style={styles.kicker}>{t('cart.paymentTitle')}</Text>

      {savedCards.length > 0 && (
        <View style={styles.savedBlock}>
          {savedCards.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.savedRow, selectedCardId === c.id && styles.savedRowActive]}
              onPress={() => setSelectedCardId(c.id)}
              activeOpacity={0.85}
            >
              <Radio on={selectedCardId === c.id} />
              <Text style={styles.savedRowText}>💳 {formatSavedCard(c, t('step4.savedCardExp'))}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.savedRow, selectedCardId === null && styles.savedRowActive]}
            onPress={() => setSelectedCardId(null)}
            activeOpacity={0.85}
          >
            <Radio on={selectedCardId === null} />
            <Text style={[styles.savedRowText, { color: GOLD }]}>{t('step4.useNewCard')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Toujours monté : instance Stripe nécessaire pour un éventuel 3DS sur carte enregistrée. */}
      <StripeCardField
        ref={cardFieldRef}
        incompleteMessage={t('step4.cardIncomplete')}
        onChange={setCardDetails}
        hideForm={!!selectedCardId}
      />
      {/* Sur web, StripeCardField affiche déjà sa propre aide de saisie. */}
      {selectedCardId ? (
        <Text style={styles.hint}>{t('step4.savedCardHint')}</Text>
      ) : Platform.OS !== 'web' ? (
        <Text style={styles.hint}>{t('step4.cardFieldHint')}</Text>
      ) : null}
    </View>
  );
});

function Radio({ on }: { on: boolean }) {
  return (
    <View style={[styles.radio, on && styles.radioOn]}>
      {on && <View style={styles.radioDot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1A1814', borderRadius: 16, padding: 18, marginBottom: 16 },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 2.5, color: GOLD, textTransform: 'uppercase', marginBottom: 14 },
  savedBlock: { gap: 8, marginBottom: 12 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  savedRowActive: { borderColor: GOLD, backgroundColor: 'rgba(201,168,76,0.08)' },
  savedRowText: { fontSize: 14, color: '#fff' },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: GOLD },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GOLD },
  hint: { fontSize: 11.5, color: 'rgba(255,255,255,0.4)', marginTop: 10, lineHeight: 16 },
});
