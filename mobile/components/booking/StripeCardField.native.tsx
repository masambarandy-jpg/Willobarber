import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { CardField, useConfirmPayment, type CardFieldInput } from '@stripe/stripe-react-native';
import { paymentsApi } from '@/services/api';
import type { StripeCardFieldHandle, StripeCardFieldProps } from './StripeCardField.types';

// Fond clair + bordure visible : le client doit voir clairement où saisir
// les informations de carte, plutôt que sur le fond sombre habituel de l'app.
const INPUT_BG     = '#FAF8F4';
const INPUT_BORDER = '#D9D2C1';

const cardFieldStyle: CardFieldInput.Styles = {
  backgroundColor: INPUT_BG,
  borderColor: INPUT_BORDER,
  borderWidth: 1.5,
  borderRadius: 10,
  textColor: '#1A1208',
  placeholderColor: 'rgba(26,18,8,0.35)',
  fontSize: 14,
};

export const StripeCardField = forwardRef<StripeCardFieldHandle, StripeCardFieldProps>(
  function StripeCardField({ onChange, incompleteMessage, hideForm }, ref) {
    const { confirmPayment } = useConfirmPayment();
    const detailsRef = useRef<CardFieldInput.Details | undefined>(undefined);

    useImperativeHandle(ref, () => ({
      pay: async (amount, cardForm, savedPaymentMethodId) => {
        if (savedPaymentMethodId) {
          const intent = await paymentsApi.createPaymentIntent(amount, 'eur', savedPaymentMethodId);
          if (intent.status === 'succeeded' && intent.paymentIntentId) return intent.paymentIntentId;
          // requires_action : 3DS exigé par la banque malgré la carte
          // enregistrée → confirmation dans l'app, qui affiche le challenge.
          const { paymentIntent, error } = await confirmPayment(intent.clientSecret, {
            paymentMethodType: 'Card',
            paymentMethodData: { paymentMethodId: savedPaymentMethodId },
          });
          if (error) throw new Error(error.message);
          if (!paymentIntent || paymentIntent.status !== 'Succeeded') throw new Error(incompleteMessage);
          return paymentIntent.id;
        }

        if (!detailsRef.current?.complete) {
          throw new Error(incompleteMessage);
        }

        const { clientSecret } = await paymentsApi.createPaymentIntent(amount, 'eur');

        const { paymentIntent, error } = await confirmPayment(clientSecret, {
          paymentMethodType: 'Card',
          paymentMethodData: {
            billingDetails: {
              email: cardForm.email || undefined,
              phone: cardForm.phone || undefined,
              name: `${cardForm.prenom} ${cardForm.nom}`.trim() || undefined,
            },
          },
        });

        if (error) {
          throw new Error(error.message);
        }
        if (!paymentIntent || paymentIntent.status !== 'Succeeded') {
          throw new Error(incompleteMessage);
        }

        return paymentIntent.id;
      },
    }));

    if (hideForm) return null;

    return (
      <CardField
        postalCodeEnabled={false}
        placeholders={{ number: '1234 5678 9012 3456', expiration: 'MM/AA', cvc: 'CVV' }}
        cardStyle={cardFieldStyle}
        style={styles.cardField}
        onCardChange={(details) => {
          detailsRef.current = details;
          onChange({
            complete: details.complete,
            last4: details.last4,
            expiryMonth: details.expiryMonth,
            expiryYear: details.expiryYear,
          });
        }}
      />
    );
  }
);

const styles = StyleSheet.create({
  cardField: {
    width: '100%',
    height: 50,
    marginBottom: 4,
  },
});
